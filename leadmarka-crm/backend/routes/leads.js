const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { subscriptionMiddleware } = require('../middleware/subscription');
const { getWorkspaceMemberIds, fetchProfilesByIds } = require('../utils/workspace');
const { logActivity } = require('../utils/activity');
const { sendLeadAssignedEmail, sendLeadReassignedAwayEmail } = require('../services/reminderService');
const { getDateStringInTimeZone, resolveTimeZone, DEFAULT_TIMEZONE } = require('../utils/timezone');

const router = express.Router();
const TEAM_INBOX_ENABLED = String(process.env.TEAM_INBOX_ENABLED || '').toLowerCase() === 'true';
const SOURCE_VALUES = ['whatsapp', 'instagram', 'facebook', 'walk_in', 'referral', 'other'];
const LEAD_STATUS_VALUES = ['new', 'contacted', 'quoted', 'follow-up', 'negotiating', 'won', 'lost'];
const URGENCY_VALUES = ['now', 'soon', 'browsing'];
const VIEWER_STALE_MS = 60 * 1000;
const LEAD_VIEWERS_MIGRATION = 'leadmarka-crm/database/migrations/2026-02-06_lead-viewers.sql';

const isMissingRelationError = (error) => {
  const message = error?.message || '';
  return message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist');
};

const cleanupStaleViewers = async (leadId) => {
  const cutoff = new Date(Date.now() - VIEWER_STALE_MS).toISOString();
  const { error } = await supabase
    .from('lead_viewers')
    .delete()
    .eq('lead_id', leadId)
    .lt('last_seen_at', cutoff);
  return error;
};

const CONVERSATION_LABEL_RENAMES = {
  'Price asked': 'Price enquiry',
  'Sent catalog': 'Catalog sent',
  'Needs delivery fee': 'Delivery pending',
  'Checking stock': 'Stock check in progress',
  'Waiting payday': 'Waiting for payday',
  'No response': 'Awaiting response',
  'Not interested': 'Closed – Lost',
};

const normalizeConversationLabel = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (!trimmed) return null;

  // "Follow-up tomorrow" is no longer a tag; use scheduled follow-ups instead.
  if (trimmed === 'Follow-up tomorrow') return null;

  return CONVERSATION_LABEL_RENAMES[trimmed] || trimmed;
};

// Format phone number to international format
const formatPhoneNumber = (phoneNumber, defaultCountry = 'ZW') => {
  try {
    // Try to parse with Zimbabwe as default
    const parsed = parsePhoneNumber(phoneNumber, defaultCountry);
    
    if (parsed && parsed.isValid()) {
      return parsed.formatInternational();
    }
    
    // If that doesn't work, try as international format
    if (isValidPhoneNumber(phoneNumber)) {
      const parsedInt = parsePhoneNumber(phoneNumber);
      return parsedInt.formatInternational();
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Get all leads
router.get('/', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  query('status').optional().trim().toLowerCase().isIn(LEAD_STATUS_VALUES),
  query('search').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, search } = req.query;
    const ownerId = req.workspaceOwnerId;

    let query = supabase
      .from('leads')
      .select(`
        *,
        notes:notes(id, content, created_at)
      `)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data: leads, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const assignedUserIds = TEAM_INBOX_ENABLED
      ? Array.from(new Set(leads.map((lead) => lead.assigned_user_id).filter(Boolean)))
      : [];
    const assignedProfiles = TEAM_INBOX_ENABLED && assignedUserIds.length > 0
      ? await fetchProfilesByIds(assignedUserIds)
      : [];
    const profileById = new Map((assignedProfiles || []).map((profile) => [profile.id, profile]));

    // Format leads with latest note
    const formattedLeads = leads.map((lead) => {
      const latestNote = lead.notes && lead.notes.length > 0 
        ? lead.notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;
      const assignedProfile = TEAM_INBOX_ENABLED && lead.assigned_user_id
        ? profileById.get(lead.assigned_user_id)
        : null;

      return {
        id: lead.id,
        name: lead.name,
        phoneNumber: lead.phone_number,
        email: lead.email || null,
        companyName: lead.company_name || null,
        productOrService: lead.product_or_service || null,
        variantSpecs: lead.variant_specs || null,
        budgetRange: lead.budget_range || null,
        urgency: lead.urgency || null,
        source: lead.source || null,
        referrerName: lead.referrer_name || null,
        status: lead.status ? lead.status.toLowerCase() : lead.status,
        conversationLabel: lead.conversation_label || null,
        lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
        lastMessageSummary: lead.last_message_summary || null,
        assignedUserId: lead.assigned_user_id || null,
        ...(TEAM_INBOX_ENABLED ? {
          assignedUser: assignedProfile
            ? {
                id: assignedProfile.id,
                fullName: assignedProfile.full_name,
                businessName: assignedProfile.business_name,
              }
            : null,
        } : {}),
        createdAt: lead.created_at,
        updatedAt: lead.updated_at,
        latestNote: latestNote ? {
          content: latestNote.content,
          createdAt: latestNote.created_at,
        } : null,
        whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
      };
    });

    res.json(formattedLeads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Team Inbox - shared lead list with assignment/follow-up context
router.get('/inbox', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  query('status').optional().trim().toLowerCase().isIn(LEAD_STATUS_VALUES),
  query('assignedToMe').optional().isBoolean().toBoolean(),
  query('unassigned').optional().isBoolean().toBoolean(),
  query('overdue').optional().isBoolean().toBoolean(),
], async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ownerId = req.workspaceOwnerId;
    const userId = req.userId;
    const { status } = req.query;
    const assignedToMe = req.query.assignedToMe === true;
    const unassigned = req.query.unassigned === true;
    const overdueOnly = req.query.overdue === true;

    let query = supabase
      .from('leads')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (assignedToMe) {
      query = query.eq('assigned_user_id', userId);
    } else if (unassigned) {
      query = query.is('assigned_user_id', null);
    }

    const { data: leads, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const leadRows = leads || [];
    if (leadRows.length === 0) {
      return res.json([]);
    }

    const leadIds = leadRows.map((lead) => lead.id);
    const assignedUserIds = Array.from(new Set(leadRows.map((lead) => lead.assigned_user_id).filter(Boolean)));

    const [{ data: followUps, error: followUpError }, profiles] = await Promise.all([
      supabase
        .from('follow_ups')
        .select('lead_id, follow_up_date, follow_up_time, completed')
        .in('lead_id', leadIds)
        .eq('completed', false)
        .order('follow_up_date', { ascending: true })
        .order('follow_up_time', { ascending: true }),
      fetchProfilesByIds(assignedUserIds),
    ]);

    if (followUpError) {
      return res.status(400).json({ error: followUpError.message });
    }

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const nextFollowUpByLead = new Map();

    (followUps || []).forEach((fu) => {
      if (!nextFollowUpByLead.has(fu.lead_id)) {
        nextFollowUpByLead.set(fu.lead_id, fu);
      }
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    const userTimeZone = profileError ? DEFAULT_TIMEZONE : resolveTimeZone(profile?.timezone);
    const todayStr = getDateStringInTimeZone(new Date(), userTimeZone);

    const response = leadRows.map((lead) => {
      const nextFollowUp = nextFollowUpByLead.get(lead.id) || null;
      const isOverdue = Boolean(nextFollowUp && nextFollowUp.follow_up_date < todayStr);
      const assignedProfile = lead.assigned_user_id ? profileById.get(lead.assigned_user_id) : null;

      return {
        id: lead.id,
        name: lead.name,
        phoneNumber: lead.phone_number,
        email: lead.email || null,
        companyName: lead.company_name || null,
        source: lead.source || null,
        referrerName: lead.referrer_name || null,
        status: lead.status ? lead.status.toLowerCase() : lead.status,
        assignedUserId: lead.assigned_user_id || null,
        assignedUser: assignedProfile
          ? {
              id: assignedProfile.id,
              fullName: assignedProfile.full_name,
              businessName: assignedProfile.business_name,
            }
          : null,
        nextFollowUpDate: nextFollowUp ? nextFollowUp.follow_up_date : null,
        nextFollowUpTime: nextFollowUp ? nextFollowUp.follow_up_time : null,
        isOverdue,
        whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
      };
    });

    const filtered = overdueOnly ? response.filter((row) => row.isOverdue) : response;
    res.json(filtered);
  } catch (error) {
    console.error('Get inbox leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single lead
router.get('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.workspaceOwnerId;

    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        notes:notes(id, content, created_at, updated_at, user_id)
      `)
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (error || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get active follow-up
    const { data: followUps, error: followUpError } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('lead_id', id)
      .eq('completed', false)
      .order('follow_up_date', { ascending: true })
      .order('follow_up_time', { ascending: true })
      .limit(1);

    const activeFollowUp = followUps && followUps.length > 0 ? followUps[0] : null;

    // Sort notes by newest first
    const sortedNotes = lead.notes ? lead.notes.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    ) : [];

    const noteUserIds = Array.from(new Set(
      sortedNotes.map((note) => note.user_id).filter(Boolean)
    ));
    const noteProfiles = await fetchProfilesByIds(noteUserIds);
    const noteProfileById = new Map(
      noteProfiles.map((profile) => [profile.id, profile])
    );

    let assignedUser = null;
    if (lead.assigned_user_id) {
      const { data: assignedProfile } = await supabase
        .from('profiles')
        .select('id, full_name, business_name')
        .eq('id', lead.assigned_user_id)
        .single();

      if (assignedProfile) {
        assignedUser = {
          id: assignedProfile.id,
          fullName: assignedProfile.full_name,
          businessName: assignedProfile.business_name,
        };
      }
    }

    res.json({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phone_number,
      email: lead.email || null,
      companyName: lead.company_name || null,
      productOrService: lead.product_or_service || null,
      variantSpecs: lead.variant_specs || null,
      budgetRange: lead.budget_range || null,
      urgency: lead.urgency || null,
      source: lead.source || null,
      referrerName: lead.referrer_name || null,
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      lastMessageSummary: lead.last_message_summary || null,
      assignedUserId: lead.assigned_user_id || null,
      assignedUser,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
      activeFollowUp: activeFollowUp ? {
        id: activeFollowUp.id,
        date: activeFollowUp.follow_up_date,
        time: activeFollowUp.follow_up_time,
        note: activeFollowUp.note,
      } : null,
      notes: sortedNotes.map((note) => {
        const profile = noteProfileById.get(note.user_id) || null;
        return {
          id: note.id,
          content: note.content,
          createdAt: note.created_at,
          updatedAt: note.updated_at,
          createdBy: profile ? {
            id: profile.id,
            fullName: profile.full_name,
            businessName: profile.business_name,
          } : null,
        };
      }),
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark lead as currently being viewed (heartbeat)
router.post('/:id/viewing', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const viewerFullName = profile?.full_name || req.userEmail || 'Team member';

    const { error: upsertError } = await supabase
      .from('lead_viewers')
      .upsert({
        lead_id: id,
        user_id: userId,
        viewer_full_name: viewerFullName,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'lead_id,user_id' });

    if (upsertError) {
      if (isMissingRelationError(upsertError)) {
        return res.status(400).json({
          error: `Database needs update. Run ${LEAD_VIEWERS_MIGRATION} in Supabase SQL Editor.`,
        });
      }
      return res.status(400).json({ error: upsertError.message });
    }

    const cleanupError = await cleanupStaleViewers(id);
    if (cleanupError) {
      console.error('Cleanup lead viewers error:', cleanupError);
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Lead viewing heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current viewers for a lead
router.get('/:id/viewers', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.workspaceOwnerId;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const cleanupError = await cleanupStaleViewers(id);
    if (cleanupError) {
      console.error('Cleanup lead viewers error:', cleanupError);
    }

    const { data: viewers, error: viewersError } = await supabase
      .from('lead_viewers')
      .select('user_id, viewer_full_name, last_seen_at')
      .eq('lead_id', id)
      .order('last_seen_at', { ascending: false });

    if (viewersError) {
      if (isMissingRelationError(viewersError)) {
        return res.status(400).json({
          error: `Database needs update. Run ${LEAD_VIEWERS_MIGRATION} in Supabase SQL Editor.`,
        });
      }
      return res.status(400).json({ error: viewersError.message });
    }

    res.json((viewers || []).map((viewer) => ({
      id: viewer.user_id,
      fullName: viewer.viewer_full_name,
      lastSeenAt: viewer.last_seen_at,
    })));
  } catch (error) {
    console.error('Get lead viewers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create lead
router.post('/', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('companyName').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Company name must be 200 characters or less'),
  body('productOrService').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Product or service must be 200 characters or less'),
  body('variantSpecs').optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage('Variant specs must be 300 characters or less'),
  body('budgetRange').optional({ nullable: true }).trim().isLength({ max: 120 }).withMessage('Budget range must be 120 characters or less'),
  body('urgency').optional({ nullable: true }).trim().toLowerCase().isIn(URGENCY_VALUES).withMessage('Invalid urgency'),
  body('source').optional({ nullable: true }).trim().toLowerCase().isIn(SOURCE_VALUES).withMessage('Invalid source'),
  body('referrerName').optional({ nullable: true }).trim().isLength({ max: 120 }).withMessage('Referrer name must be 120 characters or less'),
  body('status').optional().trim().toLowerCase().isIn(LEAD_STATUS_VALUES),
  body('conversationLabel').optional({ nullable: true }).trim().isLength({ max: 60 }).withMessage('Conversation label must be 60 characters or less'),
  body('lastMessageSummary').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('Last message summary must be 500 characters or less'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phoneNumber, email, companyName, productOrService, variantSpecs, budgetRange, urgency, source, referrerName, status = 'new', conversationLabel, lastMessageSummary } = req.body;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Invalid phone number. Please use international format (e.g., +263771234567)' });
    }

    const insertPayload = {
      user_id: ownerId,
      assigned_user_id: userId,
      name,
      phone_number: formattedPhone,
      status,
      conversation_label: normalizeConversationLabel(conversationLabel),
    };
    if (email !== undefined && email !== null) insertPayload.email = email.trim() || null;
    if (companyName !== undefined && companyName !== null) insertPayload.company_name = companyName.trim() || null;
    if (productOrService !== undefined && productOrService !== null) {
      insertPayload.product_or_service = productOrService.trim() || null;
    }
    if (variantSpecs !== undefined && variantSpecs !== null) {
      insertPayload.variant_specs = variantSpecs.trim() || null;
    }
    if (budgetRange !== undefined && budgetRange !== null) {
      insertPayload.budget_range = budgetRange.trim() || null;
    }
    if (urgency !== undefined && urgency !== null) {
      insertPayload.urgency = urgency ? urgency.trim().toLowerCase() : null;
    }
    if (source !== undefined && source !== null) insertPayload.source = source.trim() || null;
    if (referrerName !== undefined && referrerName !== null) insertPayload.referrer_name = referrerName.trim() || null;
    if (lastMessageSummary !== undefined && lastMessageSummary !== null) {
      insertPayload.last_message_summary = lastMessageSummary.trim() || null;
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logActivity({
      leadId: lead.id,
      userId,
      action: 'lead_created',
      metadata: { assignedUserId: userId, status: lead.status },
    });

    res.status(201).json({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phone_number,
      email: lead.email || null,
      companyName: lead.company_name || null,
      productOrService: lead.product_or_service || null,
      variantSpecs: lead.variant_specs || null,
      budgetRange: lead.budget_range || null,
      urgency: lead.urgency || null,
      source: lead.source || null,
      referrerName: lead.referrer_name || null,
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      lastMessageSummary: lead.last_message_summary || null,
      assignedUserId: lead.assigned_user_id || null,
      createdAt: lead.created_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lead
router.put('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  body('name').optional().trim().notEmpty(),
  body('phoneNumber').optional().trim(),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail().withMessage('Invalid email format'),
  body('companyName').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Company name must be 200 characters or less'),
  body('productOrService').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Product or service must be 200 characters or less'),
  body('variantSpecs').optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage('Variant specs must be 300 characters or less'),
  body('budgetRange').optional({ nullable: true }).trim().isLength({ max: 120 }).withMessage('Budget range must be 120 characters or less'),
  body('urgency').optional({ nullable: true }).trim().toLowerCase().isIn(URGENCY_VALUES).withMessage('Invalid urgency'),
  body('source').optional({ nullable: true }).trim().toLowerCase().isIn(SOURCE_VALUES).withMessage('Invalid source'),
  body('referrerName').optional({ nullable: true }).trim().isLength({ max: 120 }).withMessage('Referrer name must be 120 characters or less'),
  body('status').optional().trim().toLowerCase().isIn(LEAD_STATUS_VALUES),
  body('conversationLabel').optional({ nullable: true }).trim().isLength({ max: 60 }).withMessage('Conversation label must be 60 characters or less'),
  body('lastWhatsappContactAt').optional({ nullable: true }).isISO8601().withMessage('lastWhatsappContactAt must be a valid ISO-8601 timestamp'),
  body('lastMessageSummary').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('Last message summary must be 500 characters or less'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phoneNumber, email, companyName, productOrService, variantSpecs, budgetRange, urgency, source, referrerName, status, conversationLabel, lastWhatsappContactAt, lastMessageSummary } = req.body;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;
    const isOwner = req.workspaceRole === 'owner' || userId === ownerId;

    const { data: existingLead, error: existingError } = await supabase
      .from('leads')
      .select('id, user_id, assigned_user_id, status, name, phone_number, email, company_name, product_or_service, variant_specs, budget_range, urgency, source, referrer_name, conversation_label, last_whatsapp_contact_at, last_message_summary')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (existingError || !existingLead) {
      const msg = existingError?.message || '';
      const schemaError = typeof msg === 'string' && (
        msg.toLowerCase().includes('column') && msg.toLowerCase().includes('does not exist')
      );
      if (schemaError) {
        return res.status(400).json({
          error: 'Database schema needs update. Run leadmarka-crm/database/migrations/2026-02-08_lead-identity-source.sql in Supabase SQL Editor, then restart the backend.',
        });
      }
      return res.status(404).json({ error: 'Lead not found' });
    }

    const isAssigned = existingLead.assigned_user_id === userId;
    if (!isOwner) {
      const wantsStatusUpdate = status !== undefined;
      const wantsOtherUpdates =
        name !== undefined ||
        phoneNumber !== undefined ||
        email !== undefined ||
        companyName !== undefined ||
        productOrService !== undefined ||
        variantSpecs !== undefined ||
        budgetRange !== undefined ||
        urgency !== undefined ||
        source !== undefined ||
        referrerName !== undefined ||
        conversationLabel !== undefined ||
        lastWhatsappContactAt !== undefined ||
        lastMessageSummary !== undefined;

      if (!isAssigned && (wantsStatusUpdate || wantsOtherUpdates)) {
        return res.status(403).json({ error: 'Only the assigned owner can update this lead' });
      }

      if (wantsOtherUpdates) {
        return res.status(403).json({ error: 'Only owners can edit lead details' });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (email !== undefined) updates.email = email ? email.trim() : null;
    if (companyName !== undefined) updates.company_name = companyName ? companyName.trim() : null;
    if (productOrService !== undefined) {
      updates.product_or_service = productOrService ? productOrService.trim() : null;
    }
    if (variantSpecs !== undefined) {
      updates.variant_specs = variantSpecs ? variantSpecs.trim() : null;
    }
    if (budgetRange !== undefined) {
      updates.budget_range = budgetRange ? budgetRange.trim() : null;
    }
    if (urgency !== undefined) {
      updates.urgency = urgency ? urgency.trim().toLowerCase() : null;
    }
    if (source !== undefined) updates.source = source ? source.trim() : null;
    if (referrerName !== undefined) updates.referrer_name = referrerName ? referrerName.trim() : null;
    if (conversationLabel !== undefined) {
      updates.conversation_label = normalizeConversationLabel(conversationLabel);
    }
    if (lastWhatsappContactAt !== undefined) {
      updates.last_whatsapp_contact_at = lastWhatsappContactAt || null;
    }
    if (lastMessageSummary !== undefined) {
      updates.last_message_summary = lastMessageSummary ? lastMessageSummary.trim() : null;
    }

    if (phoneNumber !== undefined) {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }
      updates.phone_number = formattedPhone;
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) {
      // When the row doesn't exist, PostgREST returns an error for `.single()`.
      // Everything else should surface as a 400 so schema issues are visible.
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Lead not found' });
      }
      return res.status(400).json({ error: error.message });
    }

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phone_number,
      email: lead.email || null,
      companyName: lead.company_name || null,
      productOrService: lead.product_or_service || null,
      variantSpecs: lead.variant_specs || null,
      budgetRange: lead.budget_range || null,
      urgency: lead.urgency || null,
      source: lead.source || null,
      referrerName: lead.referrer_name || null,
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      lastMessageSummary: lead.last_message_summary || null,
      assignedUserId: lead.assigned_user_id || null,
      updatedAt: lead.updated_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
    });

    if (status !== undefined && status !== existingLead.status) {
      await logActivity({
        leadId: lead.id,
        userId,
        action: 'status_change',
        metadata: { from: existingLead.status, to: status },
      });
    }

    const fieldChanges = {};
    if (name !== undefined && name !== existingLead.name) fieldChanges.name = true;
    if (phoneNumber !== undefined && phoneNumber !== existingLead.phone_number) fieldChanges.phoneNumber = true;
    if (email !== undefined && (email || null) !== (existingLead.email || null)) fieldChanges.email = true;
    if (companyName !== undefined && (companyName || null) !== (existingLead.company_name || null)) fieldChanges.companyName = true;
    if (productOrService !== undefined && (productOrService || null) !== (existingLead.product_or_service || null)) {
      fieldChanges.productOrService = true;
    }
    if (variantSpecs !== undefined && (variantSpecs || null) !== (existingLead.variant_specs || null)) {
      fieldChanges.variantSpecs = true;
    }
    if (budgetRange !== undefined && (budgetRange || null) !== (existingLead.budget_range || null)) {
      fieldChanges.budgetRange = true;
    }
    if (urgency !== undefined && (urgency || null) !== (existingLead.urgency || null)) {
      fieldChanges.urgency = true;
    }
    if (source !== undefined && (source || null) !== (existingLead.source || null)) fieldChanges.source = true;
    if (referrerName !== undefined && (referrerName || null) !== (existingLead.referrer_name || null)) fieldChanges.referrerName = true;
    if (conversationLabel !== undefined && conversationLabel !== existingLead.conversation_label) fieldChanges.conversationLabel = true;
    if (lastWhatsappContactAt !== undefined && lastWhatsappContactAt !== existingLead.last_whatsapp_contact_at) {
      fieldChanges.lastWhatsappContactAt = true;
    }
    if (lastMessageSummary !== undefined && (lastMessageSummary || null) !== (existingLead.last_message_summary || null)) {
      fieldChanges.lastMessageSummary = true;
    }

    if (Object.keys(fieldChanges).length > 0) {
      await logActivity({
        leadId: lead.id,
        userId,
        action: 'lead_updated',
        metadata: fieldChanges,
      });
    }
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign or unassign a lead (owner or member self-assign)
router.patch('/:id/assign', authMiddleware, workspaceMiddleware, subscriptionMiddleware, [
  body('assignedUserId').optional({ nullable: true }).custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value !== 'string') throw new Error('assignedUserId must be a UUID');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) throw new Error('assignedUserId must be a valid UUID');
    return true;
  }),
], async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { assignedUserId } = req.body;
    const ownerId = req.workspaceOwnerId;
    const userId = req.userId;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, user_id, assigned_user_id, name, phone_number')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const isOwner = req.workspaceRole === 'owner' || req.userId === req.workspaceOwnerId;
    let nextAssignedUserId = assignedUserId;
    if (assignedUserId === '' || assignedUserId === null || assignedUserId === undefined) {
      nextAssignedUserId = null;
    } else {
      const memberIds = await getWorkspaceMemberIds(ownerId);
      if (!memberIds.includes(assignedUserId)) {
        return res.status(400).json({ error: 'User is not a member of this workspace' });
      }
    }

    if (!isOwner) {
      if (lead.assigned_user_id) {
        return res.status(403).json({ error: 'Only owners can reassign leads' });
      }
      if (!nextAssignedUserId || nextAssignedUserId !== userId) {
        return res.status(403).json({
          error: 'Members can only assign unassigned leads to themselves',
        });
      }
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update({ assigned_user_id: nextAssignedUserId })
      .eq('id', id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (updateError || !updatedLead) {
      return res.status(400).json({ error: updateError?.message || 'Failed to reassign lead' });
    }

    await logActivity({
      leadId: updatedLead.id,
      userId,
      action: 'lead_reassigned',
      metadata: { from: lead.assigned_user_id || null, to: nextAssignedUserId || null },
    });

    await supabase
      .from('follow_ups')
      .update({ user_id: nextAssignedUserId || ownerId })
      .eq('lead_id', id)
      .eq('completed', false);

    if (lead.assigned_user_id && lead.assigned_user_id !== nextAssignedUserId) {
      await sendLeadReassignedAwayEmail({
        userId: lead.assigned_user_id,
        leadName: lead.name,
        leadPhone: lead.phone_number,
      });
    }

    if (nextAssignedUserId) {
      await sendLeadAssignedEmail({
        userId: nextAssignedUserId,
        assignedByUserId: userId,
        leadName: lead.name,
        leadPhone: lead.phone_number,
      });
    }

    res.json({
      id: updatedLead.id,
      assignedUserId: updatedLead.assigned_user_id || null,
    });
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// One-tap: set "last WhatsApp contact" to now
router.patch('/:id/whatsapp-contact', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;
    const isOwner = req.workspaceRole === 'owner' || userId === ownerId;

    const { data: existingLead, error: leadError } = await supabase
      .from('leads')
      .select('id, assigned_user_id')
      .eq('id', id)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (!isOwner && existingLead.assigned_user_id !== userId) {
      return res.status(403).json({ error: 'Only the assigned owner can update this lead' });
    }

    const nowIso = new Date().toISOString();

    const { data: lead, error } = await supabase
      .from('leads')
      .update({ last_whatsapp_contact_at: nowIso })
      .eq('id', id)
      .eq('user_id', ownerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Lead not found' });
      }
      return res.status(400).json({ error: error.message });
    }

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      id: lead.id,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      updatedAt: lead.updated_at,
    });

    await logActivity({
      leadId: lead.id,
      userId,
      action: 'lead_updated',
      metadata: { lastWhatsappContactAt: true },
    });
  } catch (error) {
    console.error('Mark WhatsApp contacted error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete lead
router.delete('/:id', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.workspaceOwnerId;

    if (req.workspaceRole !== 'owner' && req.userId !== ownerId) {
      return res.status(403).json({ error: 'Only owners can delete leads' });
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);

    if (error) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
