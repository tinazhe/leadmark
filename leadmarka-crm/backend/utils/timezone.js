const DEFAULT_TIMEZONE = 'Africa/Harare';

const resolveTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') {
    return DEFAULT_TIMEZONE;
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch (error) {
    return DEFAULT_TIMEZONE;
  }
};

const getZonedParts = (date, timeZone) => {
  const tz = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
  };
};

const getDateStringInTimeZone = (date, timeZone) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${month}-${day}`;
};

const getTimeStringInTimeZone = (date, timeZone) => {
  const { hour, minute } = getZonedParts(date, timeZone);
  return `${hour}:${minute}`;
};

const getZonedDateTimeStrings = (date, timeZone) => ({
  date: getDateStringInTimeZone(date, timeZone),
  time: getTimeStringInTimeZone(date, timeZone),
});

const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [hour, minute] = timeStr.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
};

const formatDateLabel = (dateStr, locale = 'en-US') => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(utcDate);
};

module.exports = {
  DEFAULT_TIMEZONE,
  resolveTimeZone,
  getDateStringInTimeZone,
  getTimeStringInTimeZone,
  getZonedDateTimeStrings,
  timeToMinutes,
  formatDateLabel,
};
