const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

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
router.get('/', authMiddleware, [
  query('status').optional().trim().toLowerCase().isIn(['new', 'interested', 'follow-up', 'won', 'lost']),
  query('search').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, search } = req.query;
    const userId = req.userId;

    let query = supabase
      .from('leads')
      .select(`
        *,
        notes:notes(id, content, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data: leads, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Format leads with latest note
    const formattedLeads = leads.map(lead => {
      const latestNote = lead.notes && lead.notes.length > 0 
        ? lead.notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null;

      return {
        id: lead.id,
        name: lead.name,
        phoneNumber: lead.phone_number,
        status: lead.status ? lead.status.toLowerCase() : lead.status,
        conversationLabel: lead.conversation_label || null,
        lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
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

// Get single lead
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        notes:notes(id, content, created_at, updated_at)
      `)
      .eq('id', id)
      .eq('user_id', userId)
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

    res.json({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phone_number,
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
      activeFollowUp: activeFollowUp ? {
        id: activeFollowUp.id,
        date: activeFollowUp.follow_up_date,
        time: activeFollowUp.follow_up_time,
        note: activeFollowUp.note,
      } : null,
      notes: sortedNotes.map(note => ({
        id: note.id,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create lead
router.post('/', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('status').optional().trim().toLowerCase().isIn(['new', 'interested', 'follow-up', 'won', 'lost']),
  body('conversationLabel').optional({ nullable: true }).trim().isLength({ max: 60 }).withMessage('Conversation label must be 60 characters or less'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phoneNumber, status = 'new', conversationLabel } = req.body;
    const userId = req.userId;

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Invalid phone number. Please use international format (e.g., +263771234567)' });
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert([{
        user_id: userId,
        name,
        phone_number: formattedPhone,
        status,
        conversation_label: normalizeConversationLabel(conversationLabel),
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      id: lead.id,
      name: lead.name,
      phoneNumber: lead.phone_number,
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      createdAt: lead.created_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
    });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lead
router.put('/:id', authMiddleware, [
  body('name').optional().trim().notEmpty(),
  body('phoneNumber').optional().trim(),
  body('status').optional().trim().toLowerCase().isIn(['new', 'interested', 'follow-up', 'won', 'lost']),
  body('conversationLabel').optional({ nullable: true }).trim().isLength({ max: 60 }).withMessage('Conversation label must be 60 characters or less'),
  body('lastWhatsappContactAt').optional({ nullable: true }).isISO8601().withMessage('lastWhatsappContactAt must be a valid ISO-8601 timestamp'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phoneNumber, status, conversationLabel, lastWhatsappContactAt } = req.body;
    const userId = req.userId;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (conversationLabel !== undefined) {
      updates.conversation_label = normalizeConversationLabel(conversationLabel);
    }
    if (lastWhatsappContactAt !== undefined) {
      updates.last_whatsapp_contact_at = lastWhatsappContactAt || null;
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
      .eq('user_id', userId)
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
      status: lead.status ? lead.status.toLowerCase() : lead.status,
      conversationLabel: lead.conversation_label || null,
      lastWhatsappContactAt: lead.last_whatsapp_contact_at || null,
      updatedAt: lead.updated_at,
      whatsappUrl: `https://wa.me/${lead.phone_number.replace(/\D/g, '')}`,
    });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// One-tap: set "last WhatsApp contact" to now
router.patch('/:id/whatsapp-contact', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const nowIso = new Date().toISOString();

    const { data: lead, error } = await supabase
      .from('leads')
      .update({ last_whatsapp_contact_at: nowIso })
      .eq('id', id)
      .eq('user_id', userId)
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
  } catch (error) {
    console.error('Mark WhatsApp contacted error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete lead
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

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
