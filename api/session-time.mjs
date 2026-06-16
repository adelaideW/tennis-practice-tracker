/**
 * Parse session duration from Notion text (duration or clock range).
 * Serverless mirror of session-time.js.
 */

export function parseClockMinutes(token) {
  const t = String(token || '').trim().toLowerCase().replace(/\./g, '');
  if (!t) return null;

  const m12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const mer = m12[3];
    if (h === 12) h = 0;
    if (mer === 'pm') h += 12;
    return h * 60 + min;
  }

  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
  }

  const mHourOnly = t.match(/^(\d{1,2})\s*(am|pm)$/);
  if (mHourOnly) {
    let h = parseInt(mHourOnly[1], 10);
    if (h === 12) h = 0;
    if (mHourOnly[2] === 'pm') h += 12;
    return h * 60;
  }

  return null;
}

export function parseTimePeriodMinutes(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const rangeRe =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  let total = 0;
  let matched = false;

  for (const m of raw.matchAll(rangeRe)) {
    let start = parseClockMinutes(m[1]);
    let end = parseClockMinutes(m[2]);
    if (start == null || end == null) continue;

    const startMer = /pm/i.test(m[1]);
    const endMer = /pm/i.test(m[2]);
    const startHasMer = /am|pm/i.test(m[1]);
    const endHasMer = /am|pm/i.test(m[2]);

    if (!startHasMer && endMer && start < 12 * 60) {
      start += 12 * 60;
    }
    if (!endHasMer && startMer && end < start) {
      end += 12 * 60;
    }
    if (end <= start) end += 12 * 60;

    total += end - start;
    matched = true;
  }

  return matched ? total : null;
}

export function parseDurationMinutes(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const period = parseTimePeriodMinutes(raw);
  if (period != null) return period;

  const parts = raw.split(/\s*(?:\+|,|&|and)\s*/i).filter(Boolean);
  let total = 0;
  let matched = false;

  for (const part of parts) {
    const p = part.trim().toLowerCase();
    const hrMin = p.match(/^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/);
    if (hrMin) {
      const hrs = parseFloat(hrMin[1]);
      const mins = hrMin[2] ? parseInt(hrMin[2], 10) : 0;
      total += Math.round(hrs * 60) + mins;
      matched = true;
      continue;
    }

    const minOnly = p.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)$/);
    if (minOnly) {
      total += Math.round(parseFloat(minOnly[1]));
      matched = true;
      continue;
    }

    const bare = p.match(/^(\d+(?:\.\d+)?)(m|min)?$/);
    if (bare && (bare[2] || parseFloat(bare[1]) <= 300)) {
      total += Math.round(parseFloat(bare[1]));
      matched = true;
    }
  }

  return matched ? total : null;
}

export function extractTimeTextFromLines(lines = []) {
  for (const line of lines) {
    const m = String(line || '').match(/^(?:time|duration|played)\s*:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return '';
}

export function extractSessionMinutes({ timeText, context, lines } = {}) {
  const fromLines = extractTimeTextFromLines(lines);
  const candidates = [timeText, fromLines, context].filter(Boolean);

  for (const text of candidates) {
    const mins = parseDurationMinutes(text);
    if (mins != null && mins > 0) return mins;
  }

  return null;
}

export function resolveSessionDuration(daily, fallbackMinutes) {
  if (typeof daily?.duration === 'number' && daily.duration > 0) {
    return daily.duration;
  }
  const parsed = extractSessionMinutes({
    timeText: daily?.timeText,
    context: daily?.context,
    lines: daily?.lines,
  });
  if (parsed != null && parsed > 0) return parsed;
  return fallbackMinutes;
}

export function groupEntriesByDate(entries = [], limit = 7) {
  const byDate = new Map();

  for (const entry of entries) {
    const dateKey = (entry.date || '').slice(0, 10);
    if (!dateKey) continue;

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, {
        id: `day-${dateKey}`,
        date: entry.date,
        duration: 0,
        contexts: [],
        tags: [],
        sessionCount: 0,
      });
    }

    const group = byDate.get(dateKey);
    group.duration += entry.duration || 0;
    group.sessionCount += 1;
    if (entry.context && !group.contexts.includes(entry.context)) {
      group.contexts.push(entry.context);
    }
    (entry.tags || []).forEach((t) => {
      if (!group.tags.includes(t)) group.tags.push(t);
    });
  }

  return [...byDate.values()]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map((g) => {
      let context = g.contexts[0] || 'Practice session';
      if (g.sessionCount > 2) {
        context = `${context} · +${g.sessionCount - 1} sessions`;
      } else if (g.sessionCount === 2) {
        context = g.contexts.join(' · ');
      }
      return {
        id: g.id,
        date: g.date,
        duration: g.duration,
        context,
        tags: g.tags,
        sessionCount: g.sessionCount,
      };
    });
}
