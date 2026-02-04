const cron = require('node-cron');
const { Resend } = require('resend');
const supabase = require('../config/supabase');
const {
  DEFAULT_TIMEZONE,
  resolveTimeZone,
  getZonedDateTimeStrings,
  timeToMinutes,
  formatDateLabel,
} = require('../utils/timezone');

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_REMINDER_LEAD_MINUTES = 5;
const CLAIM_TIMEOUT_MINUTES = 15;
let supportsNotificationClaiming = true;

const addDaysToDateString = (dateString, days) => {
  const base = new Date(`${dateString}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().split('T')[0];
};

const normalizeLeadMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REMINDER_LEAD_MINUTES;
  const rounded = Math.round(parsed);
  return Math.max(0, Math.min(1440, rounded));
};

const getUserEmail = async (userId, cache) => {
  if (!userId) return null;
  if (cache && cache.has(userId)) return cache.get(userId);
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    const email = error ? null : data?.user?.email || null;
    if (cache) cache.set(userId, email);
    return email;
  } catch (err) {
    if (cache) cache.set(userId, null);
    return null;
  }
};

const fetchProfilesByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return { profiles: [], error: null };

  // Some deployments might not have the newer reminder_* columns yet.
  const attempt = async (columns) => supabase.from('profiles').select(columns).in('id', userIds);

  const { data: extended, error: extendedErr } = await attempt('id, timezone, reminder_enabled, reminder_lead_minutes');
  if (!extendedErr) return { profiles: extended || [], error: null };

  const message = extendedErr?.message || '';
  const missingColumn =
    message.includes('reminder_enabled') ||
    message.includes('reminder_lead_minutes') ||
    message.includes('does not exist');

  if (!missingColumn) return { profiles: [], error: extendedErr };

  const { data: basic, error: basicErr } = await attempt('id, timezone');
  if (basicErr) return { profiles: [], error: basicErr };
  return { profiles: basic || [], error: null };
};

const isMissingColumnError = (error, columnName) => {
  if (!error) return false;
  const message = error.message || '';
  return message.includes(columnName) && message.includes('does not exist');
};

const claimFollowUpForNotification = async (followUpId, now) => {
  if (!supportsNotificationClaiming) {
    return { claimed: true, legacy: true };
  }

  const claimTime = now.toISOString();
  const lockExpiry = new Date(now.getTime() - CLAIM_TIMEOUT_MINUTES * 60000).toISOString();

  const { data, error } = await supabase
    .from('follow_ups')
    .update({ notification_claimed_at: claimTime })
    .eq('id', followUpId)
    .eq('notified', false)
    .or(`notification_claimed_at.is.null,notification_claimed_at.lt.${lockExpiry}`)
    .select('id')
    .single();

  if (error) {
    if (isMissingColumnError(error, 'notification_claimed_at')) {
      supportsNotificationClaiming = false;
      console.warn('notification_claimed_at column missing; reminder locking disabled until migration is applied.');
      return { claimed: true, legacy: true };
    }
    console.error('Error claiming reminder:', error);
    return { claimed: false, legacy: false };
  }

  return { claimed: !!data, legacy: false };
};

const markFollowUpNotified = async (followUpId, now, legacy) => {
  const updates = { notified: true };
  if (!legacy) {
    updates.notified_at = now.toISOString();
    updates.notification_claimed_at = null;
  }

  const { error } = await supabase
    .from('follow_ups')
    .update(updates)
    .eq('id', followUpId);

  if (error) {
    console.error('Error marking follow-up notified:', error);
  }
};

const releaseFollowUpClaim = async (followUpId) => {
  const { error } = await supabase
    .from('follow_ups')
    .update({ notification_claimed_at: null })
    .eq('id', followUpId)
    .eq('notified', false);

  if (error) {
    console.error('Error releasing reminder claim:', error);
  }
};

// Send reminder email
const sendReminderEmail = async (userEmail, followUp, lead) => {
  try {
    const formattedDate = formatDateLabel(followUp.follow_up_date);
    const formattedTime = followUp.follow_up_time;
    
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: userEmail,
      subject: `Reminder: Follow-up with ${lead.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">LeadMarka Follow-up Reminder</h2>
          <p>You have a follow-up scheduled:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0;">${lead.name}</h3>
            <p style="margin: 4px 0;"><strong>Phone:</strong> ${lead.phone_number}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime}</p>
            ${followUp.note ? `<p style="margin: 4px 0;"><strong>Note:</strong> ${followUp.note}</p>` : ''}
          </div>
          
          <a href="https://wa.me/${lead.phone_number.replace(/\D/g, '')}" 
             style="display: inline-block; background: #25d366; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Chat on WhatsApp
          </a>
          
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            Open LeadMarka to view all your follow-ups.
          </p>
        </div>
      `,
    });
    
    console.log(`Reminder email sent to ${userEmail} for lead ${lead.name}`);
    return true;
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    return false;
  }
};

// Check and send reminders
const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    // Limit future scan to reduce load; allow all past-due reminders so downtime doesn't miss emails.
    const rangeEnd = new Date(now.getTime() + 2 * 24 * 60 * 60000).toISOString().split('T')[0];

    const { data: followUps, error } = await supabase
      .from('follow_ups')
      .select('id, lead_id, user_id, follow_up_date, follow_up_time, note')
      .eq('completed', false)
      .eq('notified', false)
      .lte('follow_up_date', rangeEnd);

    if (error) {
      console.error('Error fetching reminders:', error);
      return;
    }

    if (!followUps || followUps.length === 0) {
      return;
    }

    const emailCache = new Map();
    const leadIds = [...new Set(followUps.map((fu) => fu.lead_id).filter(Boolean))];
    const userIds = [...new Set(followUps.map((fu) => fu.user_id).filter(Boolean))];

    const [{ data: leads, error: leadsErr }, profilesResult] = await Promise.all([
      supabase.from('leads').select('id, name, phone_number').in('id', leadIds),
      fetchProfilesByIds(userIds),
    ]);

    if (leadsErr) {
      console.error('Error fetching leads for reminders:', leadsErr);
      return;
    }
    if (profilesResult.error) {
      console.error('Error fetching profiles for reminders:', profilesResult.error);
      return;
    }

    const leadById = new Map((leads || []).map((lead) => [lead.id, lead]));
    const profileById = new Map((profilesResult.profiles || []).map((profile) => [profile.id, profile]));

    // Send reminders
    for (const followUp of followUps) {
      const userEmail = await getUserEmail(followUp.user_id, emailCache);
      const profile = profileById.get(followUp.user_id) || null;
      const lead = leadById.get(followUp.lead_id) || null;
      const userTimeZone = resolveTimeZone(profile?.timezone || DEFAULT_TIMEZONE);
      const reminderEnabled = profile?.reminder_enabled !== false;
      const reminderLeadMinutes = normalizeLeadMinutes(profile?.reminder_lead_minutes);

      if (!reminderEnabled) {
        continue;
      }
      
      if (!userEmail) {
        console.log(`No email found for user ${followUp.user_id}`);
        continue;
      }

      if (!lead) {
        continue;
      }

      const nowLocal = getZonedDateTimeStrings(now, userTimeZone);
      const followUpDate = followUp.follow_up_date;
      const followUpTime = followUp.follow_up_time;
      const nowMinutes = timeToMinutes(nowLocal.time);
      const followUpMinutes = timeToMinutes(followUpTime);

      if (nowMinutes === null || followUpMinutes === null) {
        continue;
      }

      let reminderDate = followUpDate;
      let reminderMinutes = followUpMinutes - reminderLeadMinutes;
      if (reminderMinutes < 0) {
        reminderMinutes += 24 * 60;
        reminderDate = addDaysToDateString(followUpDate, -1);
      }

      const isReminderDayAfter = reminderDate > nowLocal.date;
      const isReminderLaterToday = reminderDate === nowLocal.date && reminderMinutes > nowMinutes;

      if (isReminderDayAfter || isReminderLaterToday) {
        continue;
      }

      const claimResult = await claimFollowUpForNotification(followUp.id, now);
      if (!claimResult.claimed) {
        continue;
      }

      const success = await sendReminderEmail(userEmail, followUp, lead);
      
      if (success) {
        // Mark as notified
        await markFollowUpNotified(followUp.id, now, claimResult.legacy);
      } else if (!claimResult.legacy) {
        await releaseFollowUpClaim(followUp.id);
      }
    }
  } catch (error) {
    console.error('Reminder service error:', error);
  }
};

const lastSummarySentByUser = new Map();

// Send daily summary email (optional - at 8 AM local time)
const sendDailySummary = async () => {
  try {
    const now = new Date();

    const { data: usersWithFollowUps, error } = await supabase
      .from('follow_ups')
      .select('user_id')
      .eq('completed', false);

    if (error || !usersWithFollowUps || usersWithFollowUps.length === 0) {
      return;
    }

    const userIds = [...new Set(usersWithFollowUps.map((row) => row.user_id).filter(Boolean))];
    const { profiles, error: profilesErr } = await fetchProfilesByIds(userIds);
    if (profilesErr || !profiles || profiles.length === 0) {
      return;
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    const emailCache = new Map();

    for (const userId of userIds) {
      const userProfile = profileById.get(userId);
      if (!userProfile) continue;
      if (userProfile?.reminder_enabled === false) continue;

      const userEmail = await getUserEmail(userId, emailCache);
      if (!userEmail) continue;

      const userTimeZone = resolveTimeZone(userProfile?.timezone || DEFAULT_TIMEZONE);
      const { date: today, time: localTime } = getZonedDateTimeStrings(now, userTimeZone);
      const [localHourStr, localMinuteStr] = localTime.split(':');
      const localHour = Number(localHourStr);
      const localMinute = Number(localMinuteStr);

      if (localHour !== 8 || localMinute > 5) {
        continue;
      }

      if (lastSummarySentByUser.get(userId) === today) {
        continue;
      }

      const { data: followUps, error: fuError } = await supabase
        .from('follow_ups')
        .select(`
          *,
          lead:leads(name, phone_number)
        `)
        .eq('user_id', userId)
        .eq('completed', false)
        .or(`follow_up_date.eq.${today},follow_up_date.lt.${today}`)
        .order('follow_up_date', { ascending: true })
        .order('follow_up_time', { ascending: true });

      if (fuError || !followUps || followUps.length === 0) continue;

      const overdue = followUps.filter(fu => fu.follow_up_date < today);
      const todayFollowUps = followUps.filter(fu => fu.follow_up_date === today);

      // Send summary email
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: userEmail,
        subject: `Your LeadMarka Daily Summary - ${followUps.length} follow-ups pending`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Good Morning!</h2>
            <p>You have <strong>${followUps.length}</strong> follow-ups requiring your attention today:</p>
            
            ${overdue.length > 0 ? `
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0;">
                <h4 style="margin: 0 0 8px 0; color: #92400e;">⚠️ ${overdue.length} Overdue</h4>
                ${overdue.map(fu => `
                  <p style="margin: 4px 0; font-size: 14px;">
                    <strong>${fu.lead.name}</strong> - Due ${fu.follow_up_date}
                  </p>
                `).join('')}
              </div>
            ` : ''}
            
            ${todayFollowUps.length > 0 ? `
              <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0;">
                <h4 style="margin: 0 0 8px 0; color: #1e40af;">📅 ${todayFollowUps.length} Today</h4>
                ${todayFollowUps.map(fu => `
                  <p style="margin: 4px 0; font-size: 14px;">
                    <strong>${fu.lead.name}</strong> - ${fu.follow_up_time}
                  </p>
                `).join('')}
              </div>
            ` : ''}
            
            <a href="${process.env.FRONTEND_URL}" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">
              Open LeadMarka
            </a>
          </div>
        `,
      });

      lastSummarySentByUser.set(userId, today);
    }
  } catch (error) {
    console.error('Daily summary error:', error);
  }
};

// Run one cron cycle (reminders + daily summary). Used by external cron (e.g. cron-job.org).
const runCronCycle = async () => {
  await checkAndSendReminders();
  await sendDailySummary();
};

// Schedule reminder checker - runs every minute (used by long-running worker)
const scheduleReminders = () => {
  console.log('Starting reminder service...');
  cron.schedule('* * * * *', () => {
    console.log('Checking for reminders...', new Date().toISOString());
    runCronCycle();
  });
};

// Export for testing and cron API
module.exports = {
  scheduleReminders,
  runCronCycle,
  checkAndSendReminders,
  sendReminderEmail,
};

// Auto-start if this file is run directly
if (require.main === module) {
  scheduleReminders();
}
