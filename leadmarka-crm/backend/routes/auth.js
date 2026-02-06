const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { Resend } = require('resend');
const { buildEmailLayoutHtml, buildEmailButtonHtml } = require('../services/reminderService');
const { resolveWorkspaceContext } = require('../middleware/workspace');

const router = express.Router();

const TEAM_INBOX_ENABLED = String(process.env.TEAM_INBOX_ENABLED || '').toLowerCase() === 'true';
const resend = new Resend(process.env.RESEND_API_KEY);

const isMissingWorkspaceTable = (error) => {
  const message = error?.message || '';
  return message.includes('workspace_members') && message.includes('does not exist');
};

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').trim().notEmpty(),
  body('inviteToken').optional().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      password,
      fullName,
      businessName,
      timezone,
      reminderEnabled,
      reminderLeadMinutes,
      dailySummaryEnabled,
      dailySummaryTime,
      inviteToken,
    } = req.body;

    let pendingInvite = null;
    if (inviteToken) {
      const { data: invite, error: inviteError } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('token', inviteToken)
        .single();

      if (inviteError) {
        const message = inviteError?.message || '';
        if (message.includes('pending_invites') && message.includes('does not exist')) {
          return res.status(400).json({
            error: 'Database needs update. Run leadmarka-crm/database/migrations/2026-02-05_team-inbox-foundation.sql in Supabase SQL Editor.',
          });
        }
      }

      if (inviteError || !invite) {
        return res.status(400).json({ error: 'Invite token is invalid or expired' });
      }

      const isExpired = invite.expires_at && new Date(invite.expires_at).getTime() < Date.now();
      if (isExpired) {
        return res.status(400).json({ error: 'Invite token is expired' });
      }

      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ error: 'Invite token does not match this email' });
      }

      pendingInvite = invite;
    }

    // Create user in Supabase Auth (trigger creates profile row via handle_new_user)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for MVP
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Upsert profile (trigger may have created row; upsert avoids duplicate key if trigger ran)
    const profileRow = {
      id: authData.user.id,
      full_name: fullName,
      business_name: businessName || null,
      timezone: timezone || 'Africa/Harare',
    };

    if (typeof reminderEnabled === 'boolean') {
      profileRow.reminder_enabled = reminderEnabled;
    }

    if (Number.isInteger(reminderLeadMinutes)) {
      profileRow.reminder_lead_minutes = reminderLeadMinutes;
    }

    if (typeof dailySummaryEnabled === 'boolean') {
      profileRow.daily_summary_enabled = dailySummaryEnabled;
    }

    if (typeof dailySummaryTime === 'string' && dailySummaryTime.trim()) {
      profileRow.daily_summary_time = dailySummaryTime.trim();
    }

    const { data: upsertedProfile, error: profileError } = await supabase
      .from('profiles')
      .upsert([profileRow], { onConflict: 'id' })
      .select('id')
      .single();

    if (profileError || !upsertedProfile) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      const message = profileError?.message || '';
      if (message.includes('Row Level Security') || message.includes('profiles')) {
        return res.status(400).json({
          error: 'Database setup required. Run leadmarka-crm/database/migrations/2026-02-05_profiles-on-auth-signup.sql in Supabase SQL Editor.',
        });
      }
      return res.status(400).json({ error: profileError?.message || 'Failed to create profile' });
    }

    if (pendingInvite) {
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert([{
          owner_id: pendingInvite.owner_id,
          user_id: authData.user.id,
          role: 'member',
        }]);

      if (memberError) {
        if (isMissingWorkspaceTable(memberError)) {
          await supabase.auth.admin.deleteUser(authData.user.id);
          return res.status(400).json({
            error: 'Database needs update. Run leadmarka-crm/database/migrations/2026-02-05_team-inbox-foundation.sql in Supabase SQL Editor.',
          });
        }
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: memberError.message });
      }

      await supabase
        .from('pending_invites')
        .delete()
        .eq('id', pendingInvite.id);
    } else {
      const { error: ownerError } = await supabase
        .from('workspace_members')
        .insert([{
          owner_id: authData.user.id,
          user_id: authData.user.id,
          role: 'owner',
        }]);

      if (ownerError && !isMissingWorkspaceTable(ownerError)) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: ownerError.message });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: authData.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: authData.user.id,
        email,
        fullName,
        businessName: businessName || null,
        timezone: timezone || 'Africa/Harare',
        reminderEnabled: typeof reminderEnabled === 'boolean' ? reminderEnabled : true,
        reminderLeadMinutes: Number.isInteger(reminderLeadMinutes) ? reminderLeadMinutes : 5,
        dailySummaryEnabled: typeof dailySummaryEnabled === 'boolean' ? dailySummaryEnabled : true,
        dailySummaryTime: typeof dailySummaryTime === 'string' && dailySummaryTime.trim() ? dailySummaryTime.trim() : '08:00',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: authData.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: authData.user.id,
        email,
        fullName: profile.full_name,
        businessName: profile.business_name,
        timezone: profile.timezone,
        reminderEnabled: profile.reminder_enabled,
        reminderLeadMinutes: profile.reminder_lead_minutes,
        dailySummaryEnabled: profile.daily_summary_enabled,
        dailySummaryTime: profile.daily_summary_time,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Generate reset token
    const resetToken = jwt.sign(
      { email, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send email (trim trailing dots so e.g. info@update.leadmarka.co.zw. is valid)
    const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
    const html = buildEmailLayoutHtml({
      preheader: 'Reset your LeadMarka password',
      title: 'Password reset',
      subtitle: 'Click below to choose a new password.',
      bodyHtml: `
        <p class="email-body" style="margin: 0 0 12px 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #1f2937;">
          This reset link expires in 1 hour.
        </p>
      `,
      ctaHtml: `
        <div style="margin-top: 12px;">
          ${buildEmailButtonHtml({
            href: resetUrl,
            label: 'Reset password',
            backgroundColor: '#f97316',
          })}
        </div>
      `,
    });

    const text = [
      'Password reset',
      '',
      'Use the link below to reset your password. This link expires in 1 hour.',
      resetUrl,
    ].join('\n');

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset your LeadMarka password',
      html,
      text,
    });

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Get user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    const user = users.users.find(u => u.email === decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user and profile
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(decoded.userId);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    const context = await resolveWorkspaceContext(user.id);
    let hasTeamMembers = false;
    if (TEAM_INBOX_ENABLED) {
      const { count, error } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', context.ownerId);
      if (!error) hasTeamMembers = (count || 0) > 1;
    }

    res.json({
      id: user.id,
      email: user.email,
      fullName: profile.full_name,
      businessName: profile.business_name,
      timezone: profile.timezone,
      reminderEnabled: profile.reminder_enabled,
      reminderLeadMinutes: profile.reminder_lead_minutes,
      dailySummaryEnabled: profile.daily_summary_enabled,
      dailySummaryTime: profile.daily_summary_time,
      workspaceOwnerId: context.ownerId,
      role: context.role,
      hasTeamMembers,
      teamInboxEnabled: TEAM_INBOX_ENABLED,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update profile
router.put('/profile', [
  body('fullName').optional().trim().notEmpty(),
  body('businessName').optional().trim(),
  body('timezone').optional().trim(),
  body('reminderEnabled').optional().isBoolean(),
  body('reminderLeadMinutes').optional().isInt({ min: 0, max: 1440 }),
  body('dailySummaryEnabled').optional().isBoolean(),
  body('dailySummaryTime').optional().custom((value) => {
    if (typeof value !== 'string') {
      throw new Error('dailySummaryTime must be a string in HH:MM format');
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      throw new Error('dailySummaryTime must be in HH:MM format');
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error('dailySummaryTime hour must be between 0 and 23');
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('dailySummaryTime minute must be between 0 and 59');
    }
    return true;
  }),
], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      fullName,
      businessName,
      timezone,
      reminderEnabled,
      reminderLeadMinutes,
      dailySummaryEnabled,
      dailySummaryTime,
    } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (businessName !== undefined) updates.business_name = businessName;
    if (timezone !== undefined) updates.timezone = timezone;
    if (reminderEnabled !== undefined) updates.reminder_enabled = reminderEnabled;
    if (reminderLeadMinutes !== undefined) updates.reminder_lead_minutes = reminderLeadMinutes;
    if (dailySummaryEnabled !== undefined) updates.daily_summary_enabled = dailySummaryEnabled;
    if (dailySummaryTime !== undefined) updates.daily_summary_time = typeof dailySummaryTime === 'string' ? dailySummaryTime.trim() : dailySummaryTime;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', decoded.userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      fullName: profile.full_name,
      businessName: profile.business_name,
      timezone: profile.timezone,
      reminderEnabled: profile.reminder_enabled,
      reminderLeadMinutes: profile.reminder_lead_minutes,
      dailySummaryEnabled: profile.daily_summary_enabled,
      dailySummaryTime: profile.daily_summary_time,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
