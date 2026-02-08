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
    <table role="presentation" cellpadding="0" cellspacing="0" class="email-button" style="border-collapse: separate;">
      <tr>
        <td bgcolor="${backgroundColor}" style="border-radius: 10px; mso-padding-alt: 14px 24px;">
          <a href="${safeHref}"
             style="display: inline-block; padding: 14px 24px; font-family: ${EMAIL_BRAND.font};
                    font-size: 14px; font-weight: 700; color: ${textColor}; text-decoration: none;
                    line-height: 20px; min-width: 44px; text-align: center;">
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
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; }
      .email-container { width: 100%; }
      .email-card { width: 100%; max-width: 600px; }
      .email-padding { padding: 24px; }
      .email-title { font-size: 22px; line-height: 28px; }
      .email-subtitle, .email-body { font-size: 14px; line-height: 20px; }
      .email-button a { display: inline-block; }
      @media screen and (max-width: 600px) {
        .email-card { max-width: 100% !important; }
        .email-padding { padding: 16px !important; }
        .email-title { font-size: 20px !important; line-height: 26px !important; }
        .email-subtitle, .email-body { font-size: 16px !important; line-height: 22px !important; }
        .email-button td { width: 100% !important; }
        .email-button a { display: block !important; }
      }
      @media screen and (max-width: 480px) {
        .email-padding { padding: 14px !important; }
        .email-title { font-size: 18px !important; line-height: 24px !important; }
      }
      @media (prefers-color-scheme: dark) {
        body { background: ${EMAIL_BRAND.bg}; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${EMAIL_BRAND.bg};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">
      ${safePreheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container" style="border-collapse: collapse; background: ${EMAIL_BRAND.bg};">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-card"
                 style="border-collapse: separate; width: 100%; max-width: 600px; background: #ffffff;
                        border: 1px solid ${EMAIL_BRAND.border}; border-radius: 16px; overflow: hidden;">
            <tr>
              <td style="padding: 18px 24px; border-bottom: 1px solid ${EMAIL_BRAND.border}; background: #ffffff;">
                ${headerInner}
              </td>
            </tr>
            <tr>
              <td class="email-padding" style="padding: 22px 24px 24px 24px;">
                <h1 class="email-title" style="margin: 0 0 8px 0; font-family: ${EMAIL_BRAND.font}; font-size: 22px; line-height: 28px; color: ${EMAIL_BRAND.dark};">
                  ${safeTitle}
                </h1>
                ${safeSubtitle ? `<p class="email-subtitle" style="margin: 0 0 16px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.muted};">
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

const formatDateShort = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatMoney = (amount, currency) => {
  const number = Number(amount);
  if (!Number.isFinite(number)) return '';
  const code = currency || 'USD';
  return `${code} ${number.toFixed(2)}`;
};

const sendPaymentReceiptEmail = async ({
  toEmail,
  ownerName,
  amount,
  currency,
  paynowReference,
  reference,
  periodEnd,
}) => {
  if (!toEmail) return null;

  const formattedAmount = formatMoney(amount, currency);
  const newEnd = formatDateShort(periodEnd);
  const safeOwner = ownerName ? escapeHtml(ownerName) : 'there';

  const bodyHtml = `
    <p class="email-body" style="margin: 0 0 12px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
      Hi ${safeOwner}, your LeadMarka Pro payment was received successfully.
    </p>
    <div style="margin: 12px 0 0 0; padding: 12px; background: ${EMAIL_BRAND.bg}; border: 1px solid ${EMAIL_BRAND.border}; border-radius: 12px;">
      <p class="email-body" style="margin: 0 0 6px 0; font-family: ${EMAIL_BRAND.font}; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
        Amount
      </p>
      <p class="email-body" style="margin: 0 0 12px 0; font-family: ${EMAIL_BRAND.font}; font-size: 16px; font-weight: 700; color: ${EMAIL_BRAND.dark};">
        ${escapeHtml(formattedAmount)}
      </p>
      <p class="email-body" style="margin: 0 0 6px 0; font-family: ${EMAIL_BRAND.font}; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
        Payment method
      </p>
      <p class="email-body" style="margin: 0 0 12px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
        EcoCash via Paynow
      </p>
      <p class="email-body" style="margin: 0 0 6px 0; font-family: ${EMAIL_BRAND.font}; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
        Reference
      </p>
      <p class="email-body" style="margin: 0 0 12px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
        ${escapeHtml(reference || '')}
      </p>
      ${paynowReference ? `
        <p class="email-body" style="margin: 0 0 6px 0; font-family: ${EMAIL_BRAND.font}; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
          Paynow reference
        </p>
        <p class="email-body" style="margin: 0 0 12px 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
          ${escapeHtml(paynowReference)}
        </p>
      ` : ''}
      ${newEnd ? `
        <p class="email-body" style="margin: 0 0 6px 0; font-family: ${EMAIL_BRAND.font}; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
          Next renewal
        </p>
        <p class="email-body" style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
          ${escapeHtml(newEnd)}
        </p>
      ` : ''}
    </div>
  `;

  const frontendUrl = getFrontendBaseUrl();
  const ctaHtml = frontendUrl
    ? `<div style="margin-top: 16px;">${buildEmailButtonHtml({
      href: frontendUrl,
      label: 'Open LeadMarka',
      backgroundColor: EMAIL_BRAND.orange,
    })}</div>`
    : '';

  const html = buildEmailLayoutHtml({
    preheader: 'LeadMarka Pro payment received',
    title: 'Payment received',
    subtitle: 'Your LeadMarka Pro subscription is active.',
    bodyHtml,
    ctaHtml,
  });

  const text = [
    'Payment received',
    '',
    'Your LeadMarka Pro subscription is active.',
    '',
    `Amount: ${formattedAmount}`,
    'Payment method: EcoCash via Paynow',
    `Reference: ${reference || ''}`,
    paynowReference ? `Paynow reference: ${paynowReference}` : null,
    newEnd ? `Next renewal: ${newEnd}` : null,
    frontendUrl ? `Open LeadMarka: ${frontendUrl}` : null,
  ].filter(Boolean).join('\n');

  const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
  return resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: 'LeadMarka Pro payment received',
    html,
    text,
  });
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

const getProfileName = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, business_name')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.business_name || data.full_name || null;
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
            <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
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
        <p class="email-body" style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
          ${frontendUrl ? `Open <a href="${escapeHtml(frontendUrl)}" style="color: ${EMAIL_BRAND.orange}; text-decoration: none; font-weight: 700;">LeadMarka</a> to view all your follow-ups.` : 'Open LeadMarka to view all your follow-ups.'}
        </p>
        <p class="email-body" style="margin: 8px 0 0 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
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

    const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
    await resend.emails.send({
      from: fromEmail,
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

const sendLeadAssignedEmail = async ({ userId, assignedByUserId, leadName, leadPhone }) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) return false;

    const assignedByName = await getProfileName(assignedByUserId);
    const frontendUrl = getFrontendBaseUrl();
    const safeLeadName = escapeHtml(leadName || 'Lead');
    const safeLeadPhone = escapeHtml(leadPhone || '');

    const html = buildEmailLayoutHtml({
      preheader: `Lead assigned: ${leadName || 'Lead'}`,
      title: 'New lead assigned',
      subtitle: assignedByName ? `${assignedByName} assigned you a lead.` : 'A lead was assigned to you.',
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin-top: 12px;">
          <tr>
            <td style="border: 1px solid ${EMAIL_BRAND.border}; border-left: 6px solid ${EMAIL_BRAND.orange};
                       border-radius: 12px; padding: 16px; background: #ffffff;">
              <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
                <strong>${safeLeadName}</strong><br />
                <span style="color: ${EMAIL_BRAND.muted};">${safeLeadPhone || ''}</span>
              </div>
            </td>
          </tr>
        </table>
      `,
      ctaHtml: frontendUrl
        ? buildEmailButtonHtml({ href: frontendUrl, label: 'Open LeadMarka', backgroundColor: EMAIL_BRAND.orange })
        : '',
    });

    const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
    await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `Lead assigned: ${leadName || 'Lead'}`,
      html,
      text: `Lead assigned: ${leadName || 'Lead'}${leadPhone ? ` (${leadPhone})` : ''}`,
    });

    return true;
  } catch (error) {
    console.error('Failed to send lead assigned email:', error);
    return false;
  }
};

const sendLeadReassignedAwayEmail = async ({ userId, leadName, leadPhone }) => {
  try {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) return false;

    const frontendUrl = getFrontendBaseUrl();
    const safeLeadName = escapeHtml(leadName || 'Lead');
    const safeLeadPhone = escapeHtml(leadPhone || '');

    const html = buildEmailLayoutHtml({
      preheader: `Lead reassigned: ${leadName || 'Lead'}`,
      title: 'Lead reassigned',
      subtitle: 'A lead was reassigned away from you.',
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; margin-top: 12px;">
          <tr>
            <td style="border: 1px solid ${EMAIL_BRAND.border}; border-left: 6px solid ${EMAIL_BRAND.orange};
                       border-radius: 12px; padding: 16px; background: #ffffff;">
              <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
                <strong>${safeLeadName}</strong><br />
                <span style="color: ${EMAIL_BRAND.muted};">${safeLeadPhone || ''}</span>
              </div>
            </td>
          </tr>
        </table>
      `,
      ctaHtml: frontendUrl
        ? buildEmailButtonHtml({ href: frontendUrl, label: 'Open LeadMarka', backgroundColor: EMAIL_BRAND.orange })
        : '',
    });

    const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
    await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: `Lead reassigned: ${leadName || 'Lead'}`,
      html,
      text: `Lead reassigned: ${leadName || 'Lead'}${leadPhone ? ` (${leadPhone})` : ''}`,
    });

    return true;
  } catch (error) {
    console.error('Failed to send lead reassigned email:', error);
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
                  <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: #92400e;">
                    ${escapeHtml(`${overdue.length} Overdue`)}
                  </div>
                  ${overdue
                    .map((fu) => {
                      const name = escapeHtml(fu?.lead?.name || 'Lead');
                      const date = escapeHtml(fu?.follow_up_date || '');
                      return `
                        <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; margin: 6px 0; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.dark};">
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
                  <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: ${EMAIL_BRAND.dark};">
                    ${escapeHtml(`${todayFollowUps.length} Today`)}
                  </div>
                  ${todayFollowUps
                    .map((fu) => {
                      const name = escapeHtml(fu?.lead?.name || 'Lead');
                      const time = escapeHtml(fu?.follow_up_time || '');
                      return `
                        <div class="email-body" style="font-family: ${EMAIL_BRAND.font}; margin: 6px 0; font-size: 13px; line-height: 18px; color: ${EMAIL_BRAND.dark};">
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
        <p class="email-body" style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 14px; line-height: 20px; color: ${EMAIL_BRAND.dark};">
          You have <strong>${escapeHtml(followUps.length)}</strong> follow-ups requiring your attention today.
        </p>
        ${overdueHtml}
        ${todayHtml}
      `;

      const footerHtml = `
        <div style="margin-top: 22px; padding-top: 16px; border-top: 1px solid ${EMAIL_BRAND.border};">
          <p class="email-body" style="margin: 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
            ${frontendUrl ? `Open <a href="${escapeHtml(frontendUrl)}" style="color: ${EMAIL_BRAND.orange}; text-decoration: none; font-weight: 700;">LeadMarka</a> to view all your follow-ups.` : 'Open LeadMarka to view all your follow-ups.'}
          </p>
          <p class="email-body" style="margin: 8px 0 0 0; font-family: ${EMAIL_BRAND.font}; font-size: 12px; line-height: 18px; color: ${EMAIL_BRAND.muted};">
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

      const fromEmail = (process.env.FROM_EMAIL || '').replace(/\.+$/, '').trim();
      await resend.emails.send({
        from: fromEmail,
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
// Never throws: each step is wrapped so the HTTP handler can return 200 and the job stays enabled;
// errors are logged for debugging in Vercel/server logs.
const runCronCycle = async () => {
  try {
    await checkAndSendReminders();
  } catch (err) {
    console.error('[cron] checkAndSendReminders failed:', err?.message || err);
    if (err?.stack) console.error(err.stack);
  }
  try {
    await sendDailySummary();
  } catch (err) {
    console.error('[cron] sendDailySummary failed:', err?.message || err);
    if (err?.stack) console.error(err.stack);
  }
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
  sendLeadAssignedEmail,
  sendLeadReassignedAwayEmail,
  sendPaymentReceiptEmail,
  buildEmailLayoutHtml,
  buildEmailButtonHtml,
};

// Auto-start if this file is run directly
if (require.main === module) {
  scheduleReminders();
}
