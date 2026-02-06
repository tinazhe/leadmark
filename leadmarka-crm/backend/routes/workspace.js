const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { Resend } = require('resend');
const { buildEmailLayoutHtml, buildEmailButtonHtml } = require('../services/reminderService');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { fetchProfilesByIds } = require('../utils/workspace');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const TEAM_INBOX_ENABLED = String(process.env.TEAM_INBOX_ENABLED || '').toLowerCase() === 'true';
const isMissingWorkspaceSettingsTable = (error) => {
  const message = error?.message || '';
  return message.includes('workspace_settings') && message.includes('does not exist');
};

const createInviteToken = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(32).toString('hex');
};

const getFrontendBaseUrl = () => {
  const raw = typeof process.env.FRONTEND_URL === 'string' ? process.env.FRONTEND_URL.trim() : '';
  return raw ? raw.replace(/\/+$/, '') : '';
};

const getUserEmail = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user?.email || null;
  } catch (err) {
    return null;
  }
};

const listUsersByEmail = async (email) => {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) return null;
  const users = data?.users || [];
  return users.find((user) => user.email && user.email.toLowerCase() === email.toLowerCase()) || null;
};

const sendInviteEmail = async ({ email, inviteUrl, ownerName }) => {
  if (!email || !inviteUrl) return;

  const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
  const title = 'You have been invited to LeadMarka';
  const subtitle = ownerName
    ? `${ownerName} invited you to join their LeadMarka workspace.`
    : 'You have been invited to join a LeadMarka workspace.';

  const html = buildEmailLayoutHtml({
    preheader: 'LeadMarka workspace invitation',
    title,
    subtitle,
    bodyHtml: `
      <p class="email-body" style="margin: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #1f2937;">
        This invite expires in 7 days.
      </p>
    `,
    ctaHtml: `
      <div style="margin-top: 14px;">
        ${buildEmailButtonHtml({
          href: inviteUrl,
          label: 'Accept invitation',
          backgroundColor: '#f97316',
        })}
      </div>
    `,
  });

  const text = [
    title,
    '',
    subtitle,
    '',
    `Accept invitation: ${inviteUrl}`,
    'This invite expires in 7 days.',
  ].join('\n');

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: title,
    html,
    text,
  });
};

const sendAddedEmail = async ({ email, ownerName }) => {
  if (!email) return;
  const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
  const title = 'You were added to a LeadMarka workspace';
  const subtitle = ownerName
    ? `${ownerName} added you to their LeadMarka workspace.`
    : 'You were added to a LeadMarka workspace.';

  const html = buildEmailLayoutHtml({
    preheader: 'You were added to LeadMarka',
    title,
    subtitle,
    bodyHtml: `
      <p class="email-body" style="margin: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #1f2937;">
        Log in to view shared leads.
      </p>
    `,
    ctaHtml: `
      <div style="margin-top: 14px;">
        ${buildEmailButtonHtml({
          href: getFrontendBaseUrl(),
          label: 'Open LeadMarka',
          backgroundColor: '#f97316',
        })}
      </div>
    `,
  });

  const text = [
    title,
    '',
    subtitle,
    '',
    'Log in to view shared leads.',
  ].join('\n');

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: title,
    html,
    text,
  });
};

router.get('/me', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.json({
        workspaceOwnerId: req.userId,
        role: 'owner',
        hasTeamMembers: false,
        teamInboxEnabled: false,
      });
    }

    const ownerId = req.workspaceOwnerId;
    const role = req.workspaceRole;
    let workspaceCompanyName = null;

    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('company_name')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (settingsError && !isMissingWorkspaceSettingsTable(settingsError)) {
      return res.status(400).json({ error: settingsError.message });
    }

    workspaceCompanyName = settings?.company_name || null;
    if (!workspaceCompanyName) {
      const ownerProfile = await fetchProfilesByIds([ownerId]);
      workspaceCompanyName = ownerProfile?.[0]?.business_name || null;
    }

    const { count, error } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      workspaceOwnerId: ownerId,
      role,
      hasTeamMembers: (count || 0) > 1,
      teamInboxEnabled: TEAM_INBOX_ENABLED,
      workspaceCompanyName,
    });
  } catch (error) {
    console.error('Workspace me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', authMiddleware, workspaceMiddleware, [
  body('workspaceCompanyName').trim().isLength({ min: 1, max: 120 }),
], async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    if (req.workspaceRole !== 'owner') {
      return res.status(403).json({ error: 'Only owners can update workspace settings' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ownerId = req.workspaceOwnerId;
    const workspaceCompanyName = req.body.workspaceCompanyName.trim();

    const { data, error } = await supabase
      .from('workspace_settings')
      .upsert([{
        owner_id: ownerId,
        company_name: workspaceCompanyName,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'owner_id' })
      .select('company_name')
      .single();

    if (error) {
      if (isMissingWorkspaceSettingsTable(error)) {
        return res.status(400).json({
          error: 'Database needs update. Run leadmarka-crm/database/migrations/2026-02-05_workspace-settings.sql in Supabase SQL Editor.',
        });
      }
      return res.status(400).json({ error: error.message });
    }

    res.json({ workspaceCompanyName: data?.company_name || null });
  } catch (error) {
    console.error('Update workspace settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/members', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    const ownerId = req.workspaceOwnerId;
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, created_at')
      .eq('owner_id', ownerId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const memberRows = members || [];
    const memberIds = memberRows.map((row) => row.user_id);
    const profiles = await fetchProfilesByIds(memberIds);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    const enriched = await Promise.all(
      memberRows.map(async (row) => {
        const profile = profilesById.get(row.user_id);
        const email = await getUserEmail(row.user_id);
        return {
          userId: row.user_id,
          role: row.role,
          fullName: profile?.full_name || null,
          businessName: profile?.business_name || null,
          email,
          createdAt: row.created_at,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Workspace members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/invites', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    if (req.workspaceRole !== 'owner') {
      return res.status(403).json({ error: 'Only owners can view invites' });
    }

    const ownerId = req.workspaceOwnerId;
    const { data: invites, error } = await supabase
      .from('pending_invites')
      .select('id, email, expires_at, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json((invites || []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
    })));
  } catch (error) {
    console.error('Workspace invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/invite', authMiddleware, workspaceMiddleware, [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    if (req.workspaceRole !== 'owner') {
      return res.status(403).json({ error: 'Only owners can invite members' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ownerId = req.workspaceOwnerId;
    const { email } = req.body;

    const ownerEmail = await getUserEmail(ownerId);
    if (ownerEmail && ownerEmail.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ error: 'Owner is already part of the workspace' });
    }

    const existingUser = await listUsersByEmail(email);
    if (existingUser) {
      const { data: existingMembership } = await supabase
        .from('workspace_members')
        .select('owner_id')
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMembership?.owner_id) {
        if (existingMembership.owner_id !== ownerId) {
          return res.status(400).json({ error: 'User already belongs to another workspace' });
        }
        return res.json({ status: 'already_member' });
      }

      const { error: insertError } = await supabase
        .from('workspace_members')
        .insert([{
          owner_id: ownerId,
          user_id: existingUser.id,
          role: 'member',
        }]);

      if (insertError) {
        const msg = insertError.message || '';
        if (msg.includes('workspace_members_user_unique') || msg.includes('duplicate key')) {
          return res.json({ status: 'already_member' });
        }
        return res.status(400).json({ error: insertError.message });
      }

      const ownerProfile = await fetchProfilesByIds([ownerId]);
      const ownerName = ownerProfile?.[0]?.business_name || ownerProfile?.[0]?.full_name || null;
      await sendAddedEmail({ email, ownerName });

      return res.json({ status: 'added' });
    }

    const token = createInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: inviteError } = await supabase
      .from('pending_invites')
      .insert([{
        owner_id: ownerId,
        email,
        token,
        expires_at: expiresAt,
      }]);

    if (inviteError) {
      return res.status(400).json({ error: inviteError.message });
    }

    const baseUrl = getFrontendBaseUrl();
    const inviteUrl = baseUrl ? `${baseUrl}/register?invite=${token}` : '';
    const ownerProfile = await fetchProfilesByIds([ownerId]);
    const ownerName = ownerProfile?.[0]?.business_name || ownerProfile?.[0]?.full_name || null;

    await sendInviteEmail({ email, inviteUrl, ownerName });

    res.json({ status: 'invited' });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/members/:userId', authMiddleware, workspaceMiddleware, async (req, res) => {
  try {
    if (!TEAM_INBOX_ENABLED) {
      return res.status(403).json({ error: 'Team Inbox is disabled' });
    }

    if (req.workspaceRole !== 'owner') {
      return res.status(403).json({ error: 'Only owners can remove members' });
    }

    const ownerId = req.workspaceOwnerId;
    const { userId } = req.params;

    if (userId === ownerId) {
      return res.status(400).json({ error: 'Owner cannot be removed' });
    }

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('owner_id', ownerId)
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await supabase
      .from('leads')
      .update({ assigned_user_id: null })
      .eq('user_id', ownerId)
      .eq('assigned_user_id', userId);

    res.json({ status: 'removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
