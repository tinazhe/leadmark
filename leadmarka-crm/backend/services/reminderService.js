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

const EMAIL_BRAND = {
  orange: '#f97316',
  orangeHover: '#ea580c',
  dark: '#1f2937',
  muted: '#6b7280',
  bg: '#fafafa',
  border: '#e5e7eb',
  whatsapp: '#25d366',
  font:
    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });

const getFrontendBaseUrl = () => {
  const raw = typeof process.env.FRONTEND_URL === 'string' ? process.env.FRONTEND_URL.trim() : '';
  return raw ? raw.replace(/\/+$/, '') : '';
};

const joinUrl = (baseUrl, path) => {
  const base = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!base) return '';
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
};

const buildEmailButtonHtml = ({ href, label, backgroundColor, textColor = '#ffffff' }) => {
  if (!href) return '';
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
      <tr>
        <td bgcolor="${backgroundColor}" style="border-radius: 10px;">
          <a href="${safeHref}"
             style="display: inline-block; padding: 14px 22px; font-family: ${EMAIL_BRAND.font};
                    font-size: 14px; font-weight: 700; color: ${textColor}; text-decoration: none;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
};

const buildEmailLayoutHtml = ({ preheader, title, subtitle, bodyHtml, ctaHtml, footerHtml }) => {
  const frontendUrl = getFrontendBaseUrl();
  const logoUrl = joinUrl(frontendUrl, '/icons/icon-192x192.png');
  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : '';
  const safePreheader = preheader ? escapeHtml(preheader) : '';

  const headerInner = frontendUrl
    ? `
      <a href="${escapeHtml(frontendUrl)}" style="text-decoration: none; display: inline-block;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
          <tr>
            <td style="vertical-align: middle; padding-right: 10px;">
              ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="LeadMarka" width="40" height="40"
                style="display: block; width: 40px; height: 40px; border-radius: 10px;" />` : ''}
            </td>
            <td style="vertical-align: middle;">
              <span style="font-family: ${EMAIL_BRAND.font}; font-size: 18px; font-weight: 800; color: ${EMAIL_BRAND.dark};">
                LeadMarka
              </span>
            </td>
          </tr>
        </table>
      </a>
    `
    : `
      <span style="font-family: ${EMAIL_BRAND.font}; font-size: 18px; font-weight: 800; color: ${EMAIL_BRAND.dark};">
        LeadMarka
      </span>
    `;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background: ${EMAIL_BRAND.bg};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: ${EMAIL_BRAND.bg};">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                 style="border-collapse: separate; width: 600px; max-width: 600px; background: #ffffff;
                        border: 1px solid ${EMAIL_BRAND.border}; border-radius: 16px; overflow: hidden;">
            <tr>
              <td style="padding: 18px 24px; border-bottom: 1px solid ${EMAIL_BRAND.border}; background: #ffffff;">
                ${headerInner}
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 24px 24px 24px;">
                <h1 style="margin: 0 0 8px 0; font-family: ${EMAIL_BRAND.font}; font-size: 22px; line-height: 28px; color: ${EMAIL_BRAND.dark};">
                  ${safeTitle}
                </h1>
                ${safeSubtitle ? `<p style="margin: 0 0 16px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.muted};">
                  ${safeSubtitle}
                </p>` : ''}
                ${bodyHtml || ''}
                ${ctaHtml || ''}
                ${footerHtml || ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

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

  const { data: extended, error: extendedErr } = await attempt(
    'id, timezone, reminder_enabled, reminder_lead_minutes, daily_summary_enabled, daily_summary_time'
  );
  if (!extendedErr) return { profiles: extended || [], error: null };

  const message = extendedErr?.message || '';
  const missingDailySummaryColumn =
    message.includes('daily_summary_enabled') ||
    message.includes('daily_summary_time') ||
    message.includes('does not exist');

  if (missingDailySummaryColumn) {
    const { data: reminderOnly, error: reminderOnlyErr } = await attempt('id, timezone, reminder_enabled, reminder_lead_minutes');
    if (!reminderOnlyErr) return { profiles: reminderOnly || [], error: null };
  }

  const missingReminderColumn =
    message.includes('reminder_enabled') ||
    message.includes('reminder_lead_minutes') ||
    message.includes('does not exist');

  if (!missingReminderColumn && !missingDailySummaryColumn) return { profiles: [], error: extendedErr };

  const { data: basic, error: basicErr } = await attempt('id, timezone');
  if (basicErr) return { profiles: [], error: basicErr };
  return { profiles: basic || [], error: null };
};

const normalizeDailySummaryTime = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '08:00';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return '08:00';
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return '08:00';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const isWithinDailySummaryWindow = (localTime, summaryTime, windowMinutes = 5) => {
  const localMinutes = timeToMinutes(localTime);
  const summaryMinutes = timeToMinutes(normalizeDailySummaryTime(summaryTime));
  if (!Number.isFinite(localMinutes) || !Number.isFinite(summaryMinutes)) return false;

  const endMinutes = summaryMinutes + windowMinutes;
  if (endMinutes < 1440) {
    return localMinutes >= summaryMinutes && localMinutes <= endMinutes;
  }

  // Window wraps past midnight.
  const wrapEnd = endMinutes % 1440;
  return localMinutes >= summaryMinutes || localMinutes <= wrapEnd;
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

    const leadName = escapeHtml(lead?.name || 'Lead');
    const phoneNumber = escapeHtml(lead?.phone_number || '');
    const note = followUp?.note ? escapeHtml(followUp.note) : '';
    const phoneDigits = String(lead?.phone_number || '').replace(/\D/g, '');
    const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : '';
    const frontendUrl = getFrontendBaseUrl();

    const detailsCardHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin-top: 12px;">
        <tr>
          <td style="border: 1px solid ${EMAIL_BRAND.border}; border-left: 6px solid ${EMAIL_BRAND.orange};
                     border-radius: 12px; padding: 16px; background: #ffffff;">
            <div style="font-family: ${EMAIL_BRAND.font}; font-size: 18px; line-height: 24px; font-weight: 800; color: ${EMAIL_BRAND.dark}; margin: 0 0 10px 0;">
              ${leadName}
            </div>
            <div style="font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
              <div style="margin: 8px 0 0 0;">
                <span style="color: ${EMAIL_BRAND.muted};">Phone</span><br />
                <span style="font-weight: 700;">${phoneNumber || '-'}</span>
              </div>
              <div style="margin: 8px 0 0 0;">
                <span style="color: ${EMAIL_BRAND.muted};">Date</span><br />
                <span style="font-weight: 700;">${escapeHtml(formattedDate)}</span>
              </div>
              <div style="margin: 8px 0 0 0;">
                <span style="color: ${EMAIL_BRAND.muted};">Time</span><br />
                <span style="font-weight: 700;">${escapeHtml(formattedTime)}</span>
              </div>
              ${note ? `
                <div style="margin: 8px 0 0 0;">
                  <span style="color: ${EMAIL_BRAND.muted};">Note</span><br />
                  <span style="font-weight: 600;">${note}</span>
                </div>
              ` : ''}
            </div>
          </td>
        </tr>
      </table>
    `;

    const ctaHtml = `
      <div style="margin-top: 18px;">
        ${whatsappUrl
          ? buildEmailButtonHtml({
              href: whatsappUrl,
              label: 'Chat on WhatsApp',
              backgroundColor: EMAIL_BRAND.whatsapp,
            })
          : buildEmailButtonHtml({
              href: frontendUrl,
              label: 'Open LeadMarka',
              backgroundColor: EMAIL_BRAND.orange,
            })}
      </div>
    `;

    const footerHtml = `
      <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid ${EMAIL_BRAND.border};">
        <p style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
          ${frontendUrl ? `Open <a href="${escapeHtml(frontendUrl)}" style="color: ${EMAIL_BRAND.orange}; text-decoration: none; font-weight: 700;">LeadMarka</a> to view all your follow-ups.` : 'Open LeadMarka to view all your follow-ups.'}
        </p>
        <p style="margin: 8px 0 0 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
          LeadMarka – WhatsApp CRM
        </p>
      </div>
    `;

    const html = buildEmailLayoutHtml({
      preheader: `Follow-up with ${lead?.name || 'your lead'} at ${formattedTime}`,
      title: 'Follow-up reminder',
      subtitle: 'You have a follow-up scheduled.',
      bodyHtml: detailsCardHtml,
      ctaHtml,
      footerHtml,
    });

    const text = [
      'LeadMarka Follow-up reminder',
      '',
      'You have a follow-up scheduled:',
      '',
      `Name: ${lead?.name || '-'}`,
      `Phone: ${lead?.phone_number || '-'}`,
      `Date: ${formattedDate}`,
      `Time: ${formattedTime}`,
      followUp?.note ? `Note: ${followUp.note}` : null,
      '',
      whatsappUrl ? `Chat on WhatsApp: ${whatsappUrl}` : null,
      frontendUrl ? `Open LeadMarka: ${frontendUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: userEmail,
      subject: `Reminder: Follow-up with ${lead.name}`,
      html,
      text,
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
      if (userProfile?.daily_summary_enabled === false) continue;

      const userEmail = await getUserEmail(userId, emailCache);
      if (!userEmail) continue;

      const userTimeZone = resolveTimeZone(userProfile?.timezone || DEFAULT_TIMEZONE);
      const { date: today, time: localTime } = getZonedDateTimeStrings(now, userTimeZone);
      const summaryTime = normalizeDailySummaryTime(userProfile?.daily_summary_time);

      if (!isWithinDailySummaryWindow(localTime, summaryTime, 5)) {
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

      const frontendUrl = getFrontendBaseUrl();
      const openAppButtonHtml = `
        <div style="margin-top: 18px;">
          ${buildEmailButtonHtml({
            href: frontendUrl,
            label: 'Open LeadMarka',
            backgroundColor: EMAIL_BRAND.orange,
          })}
        </div>
      `;

      const overdueHtml =
        overdue.length > 0
          ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin-top: 14px;">
              <tr>
                <td style="background: #fef3c7; border: 1px solid ${EMAIL_BRAND.border}; border-left: 6px solid #f59e0b;
                           border-radius: 12px; padding: 14px;">
                  <div style="font-family: ${EMAIL_BRAND.font}; margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: #92400e;">
                    ${escapeHtml(`${overdue.length} Overdue`)}
                  </div>
                  ${overdue
                    .map((fu) => {
                      const name = escapeHtml(fu?.lead?.name || 'Lead');
                      const date = escapeHtml(fu?.follow_up_date || '');
                      return `
                        <div style="font-family: ${EMAIL_BRAND.font}; margin: 6px 0; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.dark};">
                          <span style="font-weight: 700;">${name}</span>
                          <span style="color: ${EMAIL_BRAND.muted};"> · Due ${date}</span>
                        </div>
                      `;
                    })
                    .join('')}
                </td>
              </tr>
            </table>
          `
          : '';

      const todayHtml =
        todayFollowUps.length > 0
          ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin-top: 14px;">
              <tr>
                <td style="background: #f9fafb; border: 1px solid ${EMAIL_BRAND.border}; border-left: 6px solid ${EMAIL_BRAND.orange};
                           border-radius: 12px; padding: 14px;">
                  <div style="font-family: ${EMAIL_BRAND.font}; margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: ${EMAIL_BRAND.dark};">
                    ${escapeHtml(`${todayFollowUps.length} Today`)}
                  </div>
                  ${todayFollowUps
                    .map((fu) => {
                      const name = escapeHtml(fu?.lead?.name || 'Lead');
                      const time = escapeHtml(fu?.follow_up_time || '');
                      return `
                        <div style="font-family: ${EMAIL_BRAND.font}; margin: 6px 0; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.dark};">
                          <span style="font-weight: 700;">${name}</span>
                          <span style="color: ${EMAIL_BRAND.muted};"> · ${time}</span>
                        </div>
                      `;
                    })
                    .join('')}
                </td>
              </tr>
            </table>
          `
          : '';

      const summaryBodyHtml = `
        <p style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
          You have <strong>${escapeHtml(followUps.length)}</strong> follow-ups requiring your attention today.
        </p>
        ${overdueHtml}
        ${todayHtml}
      `;

      const footerHtml = `
        <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid ${EMAIL_BRAND.border};">
          <p style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
            ${frontendUrl ? `Open <a href="${escapeHtml(frontendUrl)}" style="color: ${EMAIL_BRAND.orange}; text-decoration: none; font-weight: 700;">LeadMarka</a> to view all your follow-ups.` : 'Open LeadMarka to view all your follow-ups.'}
          </p>
          <p style="margin: 8px 0 0 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
            LeadMarka – WhatsApp CRM
          </p>
        </div>
      `;

      const summaryHtml = buildEmailLayoutHtml({
        preheader: `You have ${followUps.length} follow-ups pending today`,
        title: 'Good morning!',
        subtitle: 'Here’s what needs your attention today.',
        bodyHtml: summaryBodyHtml,
        ctaHtml: openAppButtonHtml,
        footerHtml,
      });

      const summaryText = [
        `LeadMarka Daily Summary (${today})`,
        '',
        `You have ${followUps.length} follow-ups pending.`,
        overdue.length ? '' : null,
        overdue.length ? `${overdue.length} overdue:` : null,
        ...overdue.map((fu) => `- ${fu?.lead?.name || 'Lead'} (due ${fu?.follow_up_date || ''})`),
        todayFollowUps.length ? '' : null,
        todayFollowUps.length ? `${todayFollowUps.length} today:` : null,
        ...todayFollowUps.map((fu) => `- ${fu?.lead?.name || 'Lead'} (${fu?.follow_up_time || ''})`),
        '',
        frontendUrl ? `Open LeadMarka: ${frontendUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // Send summary email
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: userEmail,
        subject: `Your LeadMarka Daily Summary - ${followUps.length} follow-ups pending`,
        html: summaryHtml,
        text: summaryText,
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
