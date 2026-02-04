const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { Resend } = require('resend');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').trim().notEmpty(),
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
    } = req.body;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for MVP
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create profile
    const profileInsert = {
      id: authData.user.id,
      full_name: fullName,
      business_name: businessName || null,
      timezone: timezone || 'Africa/Harare',
    };

    if (typeof reminderEnabled === 'boolean') {
      profileInsert.reminder_enabled = reminderEnabled;
    }

    if (Number.isInteger(reminderLeadMinutes)) {
      profileInsert.reminder_lead_minutes = reminderLeadMinutes;
    }

    if (typeof dailySummaryEnabled === 'boolean') {
      profileInsert.daily_summary_enabled = dailySummaryEnabled;
    }

    if (typeof dailySummaryTime === 'string' && dailySummaryTime.trim()) {
      profileInsert.daily_summary_time = dailySummaryTime.trim();
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([profileInsert]);

    if (profileError) {
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
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

    // Send email
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Reset your LeadMarka password',
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
      `,
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
