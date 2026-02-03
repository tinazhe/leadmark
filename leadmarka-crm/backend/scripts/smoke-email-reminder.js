/**
 * Smoke test for email reminders:
 * - Picks (or creates) a lead for an existing user
 * - Inserts a follow-up due ~1 minute ago (in user's timezone)
 * - Runs the same reminder checker used by the server
 * - Verifies the follow-up was marked as notified, then cleans up
 *
 * Usage:
 *   node scripts/smoke-email-reminder.js
 */

require('dotenv').config();

const supabase = require('../config/supabase');
const { checkAndSendReminders } = require('../services/reminderService');
const { DEFAULT_TIMEZONE, resolveTimeZone, getZonedDateTimeStrings } = require('../utils/timezone');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pickUserId = async () => {
  // Prefer a user who already has a lead.
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('user_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!leadErr && lead?.user_id) return lead.user_id;

  // Fallback: pick any profile.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('reminder_enabled', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profErr || !profile?.id) {
    throw new Error('No users found (need at least one row in profiles and/or leads).');
  }

  return profile.id;
};

const getOrCreateLead = async (userId) => {
  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, user_id, name, phone_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && lead?.id) return { lead, created: false };

  const { data: createdLead, error: createErr } = await supabase
    .from('leads')
    .insert([
      {
        user_id: userId,
        name: 'Smoke Test Lead',
        phone_number: '+10000000000',
        status: 'follow-up',
      },
    ])
    .select('id, user_id, name, phone_number')
    .single();

  if (createErr) {
    throw new Error(`Failed to create lead: ${createErr.message}`);
  }

  return { lead: createdLead, created: true };
};

const getUserSettings = async (userId) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('timezone, reminder_enabled, reminder_lead_minutes')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { timeZone: DEFAULT_TIMEZONE, reminderEnabled: true, leadMinutes: 5 };
  }

  const leadMinutes = Number.isFinite(profile.reminder_lead_minutes) ? Math.max(0, Math.round(profile.reminder_lead_minutes)) : 5;
  return {
    timeZone: resolveTimeZone(profile?.timezone || DEFAULT_TIMEZONE),
    reminderEnabled: profile.reminder_enabled !== false,
    leadMinutes,
  };
};

const main = async () => {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RESEND_API_KEY', 'FROM_EMAIL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }

  const userId = await pickUserId();
  const { lead, created: createdLead } = await getOrCreateLead(userId);
  const { timeZone: userTimeZone, reminderEnabled, leadMinutes } = await getUserSettings(userId);

  if (!reminderEnabled) {
    throw new Error(`Picked user ${userId} has reminder_enabled=false; enable reminders or create a different user/profile.`);
  }

  // Reminders are sent "leadMinutes before follow-up".
  // Make the reminder due ~1 minute ago => follow-up time should be (leadMinutes - 1) minutes from now (local).
  const offsetMinutes = leadMinutes > 0 ? (leadMinutes - 1) : -1;
  const dueAt = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const dueLocal = getZonedDateTimeStrings(dueAt, userTimeZone);

  const { data: followUp, error: fuErr } = await supabase
    .from('follow_ups')
    .insert([
      {
        lead_id: lead.id,
        user_id: userId,
        follow_up_date: dueLocal.date,
        follow_up_time: dueLocal.time,
        note: 'smoke-test: email reminder',
        completed: false,
        notified: false,
      },
    ])
    .select('*')
    .single();

  if (fuErr) {
    throw new Error(`Failed to create follow-up: ${fuErr.message}`);
  }

  const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userErr ? null : userRes?.user?.email || null;
  console.log('[smoke] User email:', userEmail || '(missing)');

  console.log(
    '[smoke] Created follow-up:',
    followUp.id,
    'follow-up at',
    `${dueLocal.date} ${dueLocal.time}`,
    'tz',
    userTimeZone,
    'leadMinutes',
    leadMinutes
  );

  // Run the reminder check once.
  await checkAndSendReminders();

  // Give the email provider request a beat; the DB update should already be done on success.
  await sleep(1000);

  const { data: after, error: afterErr } = await supabase
    .from('follow_ups')
    .select('id, notified, completed')
    .eq('id', followUp.id)
    .single();

  if (afterErr) {
    throw new Error(`Failed to re-fetch follow-up: ${afterErr.message}`);
  }

  const passed = after.notified === true;
  console.log('[smoke] Notified status after check:', after.notified);

  // Cleanup
  await supabase.from('follow_ups').delete().eq('id', followUp.id);
  if (createdLead) {
    await supabase.from('leads').delete().eq('id', lead.id);
  }

  if (!passed) {
    throw new Error('Smoke test failed: follow-up was not marked notified=true (email likely not sent).');
  }

  console.log('[smoke] PASS: reminder email should have been sent and follow-up marked notified=true.');
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[smoke] FAIL:', err?.message || err);
    process.exit(1);
  });
