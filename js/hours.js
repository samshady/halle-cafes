/**
 * hours.js
 * Timezone-aware opening hours parser for Europe/Berlin.
 * Evaluates OSM format: "Mo-Fr 08:00-18:00; Sa 09:00-14:00"
 */

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES_DE = {
  Mo: 'Montag',
  Tu: 'Dienstag',
  We: 'Mittwoch',
  Th: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  Su: 'Sonntag'
};

/**
 * Get current time and day in Europe/Berlin
 */
export function getBerlinNow() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const weekdayShort = parts.find(p => p.type === 'weekday').value; // e.g. Mon, Tue
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);

  const dayMap = { Mon: 'Mo', Tue: 'Tu', Wed: 'We', Thu: 'Th', Fri: 'Fr', Sat: 'Sa', Sun: 'Su' };
  return {
    dayCode: dayMap[weekdayShort] || 'Mo',
    hour,
    minute,
    totalMinutes: hour * 60 + minute
  };
}

/**
 * Parse an interval string like "09:00-18:00" into { start: 540, end: 1080 }
 */
function parseInterval(str) {
  const match = str.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  let end = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
  if (end < start) {
    // Crosses midnight, e.g. 18:00-02:00
    end += 24 * 60;
  }
  return { start, end };
}

/**
 * Expand days like "Mo-Fr" or "Tu,Th,Sa" into a list of day codes
 */
function expandDays(dayPart) {
  const daysOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const res = new Set();
  const chunks = dayPart.split(',').map(s => s.trim());
  for (const chunk of chunks) {
    if (chunk.includes('-')) {
      const [start, end] = chunk.split('-');
      const sIdx = daysOrder.indexOf(start.trim());
      const eIdx = daysOrder.indexOf(end.trim());
      if (sIdx !== -1 && eIdx !== -1) {
        if (sIdx <= eIdx) {
          for (let i = sIdx; i <= eIdx; i++) res.add(daysOrder[i]);
        } else {
          for (let i = sIdx; i < 7; i++) res.add(daysOrder[i]);
          for (let i = 0; i <= eIdx; i++) res.add(daysOrder[i]);
        }
      }
    } else if (daysOrder.includes(chunk)) {
      res.add(chunk);
    }
  }
  return Array.from(res);
}

/**
 * Parses raw OSM opening hours string into a daily schedule map:
 * { Mo: [{start, end, label}], Tu: ... }
 */
export function parseOpeningHours(rawString) {
  if (!rawString || typeof rawString !== 'string') return null;

  const schedule = { Mo: [], Tu: [], We: [], Th: [], Fr: [], Sa: [], Su: [] };
  const rules = rawString.split(';').map(s => s.trim()).filter(Boolean);

  for (const rule of rules) {
    if (rule.toLowerCase().includes('off')) continue;

    // Pattern: "Mo-Fr 08:00-18:00" or "Sa,Su 10:00-18:00"
    const match = rule.match(/^([A-Za-z,\s\-]+)\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})$/);
    if (!match) continue;

    const days = expandDays(match[1]);
    const interval = parseInterval(match[2]);
    if (interval) {
      for (const d of days) {
        if (schedule[d]) {
          schedule[d].push({
            ...interval,
            rawStr: match[2].trim()
          });
        }
      }
    }
  }

  return schedule;
}

/**
 * Checks the status of a cafe given its opening_hours string.
 * Returns: { isOpen: boolean, isClosingSoon: boolean, statusClass: 'open'|'soon'|'closed'|'unknown', badgeText: string, closingTimeStr?: string }
 */
export function getCafeOpenStatus(rawHours) {
  if (!rawHours) {
    return {
      isOpen: false,
      isClosingSoon: false,
      statusClass: 'unknown',
      badgeText: 'Hours unlisted',
      label: 'Hours unlisted'
    };
  }

  const schedule = parseOpeningHours(rawHours);
  if (!schedule) {
    return {
      isOpen: false,
      isClosingSoon: false,
      statusClass: 'unknown',
      badgeText: 'Hours unlisted',
      label: rawHours
    };
  }

  const { dayCode, totalMinutes } = getBerlinNow();
  const todayIntervals = schedule[dayCode] || [];

  for (const iv of todayIntervals) {
    if (totalMinutes >= iv.start && totalMinutes < iv.end) {
      const minsLeft = iv.end - totalMinutes;
      const endH = String(Math.floor((iv.end % (24 * 60)) / 60)).padStart(2, '0');
      const endM = String(iv.end % 60).padStart(2, '0');
      const closingTimeStr = `${endH}:${endM}`;

      if (minsLeft <= 45) {
        return {
          isOpen: true,
          isClosingSoon: true,
          statusClass: 'soon',
          badgeText: `Closing soon (${closingTimeStr})`,
          label: `Open • Closes at ${closingTimeStr} (${minsLeft}m left)`,
          closingTimeStr
        };
      }
      return {
        isOpen: true,
        isClosingSoon: false,
        statusClass: 'open',
        badgeText: `Open until ${closingTimeStr}`,
        label: `Open until ${closingTimeStr}`,
        closingTimeStr
      };
    }
  }

  // If currently closed, find next open time
  return {
    isOpen: false,
    isClosingSoon: false,
    statusClass: 'closed',
    badgeText: 'Closed now',
    label: 'Closed now'
  };
}

/**
 * Format weekly schedule into clean human-readable lines
 */
export function formatWeeklySchedule(rawHours) {
  if (!rawHours) return ['No detailed opening hours recorded.'];
  const schedule = parseOpeningHours(rawHours);
  if (!schedule) return [rawHours];

  const daysOrder = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return daysOrder.map(d => {
    const ivs = schedule[d];
    const name = DAY_NAMES_DE[d] || d;
    if (!ivs || ivs.length === 0) {
      return `${name}: Geschlossen (Closed)`;
    }
    const times = ivs.map(iv => iv.rawStr).join(', ');
    return `${name}: ${times}`;
  });
}
