/* global React */
/**
 * Notion is the source of truth for sessions, stats, and today's focus brief.
 */
const NOTION_SYNC_STORAGE_KEY = 'tennis-notion-sync-v1';

const TAG_RULES = [
  { k: 'volley', re: /volley|net play|at the net/i },
  { k: 'serve', re: /serve|serving|double fault|toss/i },
  { k: 'overhead', re: /overhead|smash|lob/i },
  { k: 'ground', re: /ground|baseline|rally|forehand|backhand|stroke|slice/i },
  { k: 'return', re: /return on serve|return serve/i },
  { k: 'point', re: /game|match|double|single|usta|tiebreak/i },
  { k: 'footwork', re: /footwork|movement|split step/i },
  { k: 'mental', re: /mindset|focus|mental/i },
  { k: 'warmup', re: /wall|warm/i },
];

function inferTags(...texts) {
  const blob = texts.filter(Boolean).join(' ');
  const tags = TAG_RULES.filter((r) => r.re.test(blob)).map((r) => r.k);
  return tags.length ? [...new Set(tags)] : ['ground'];
}

function formatDailyNotes(daily) {
  const lines = [`Context: ${daily.context || 'Practice session'}`];
  if (daily.good?.length) {
    lines.push('', 'Good:');
    daily.good.forEach((g) => lines.push(`- ${g}`));
  }
  const needs = [...(daily.bad || []), ...(daily.learning || [])];
  if (needs.length) {
    lines.push('', 'Needs work:');
    needs.forEach((n) => lines.push(`- ${n}`));
  }
  return lines.join('\n');
}

function formatNotionNotes(payload) {
  if (payload?.notesDraft) return payload.notesDraft;
  const d = payload?.latestDaily;
  if (!d) return '';
  const lines = [formatDailyNotes(d)];
  if (payload.weeklyPriorities?.length) {
    lines.push('', 'Weekly focus (from Notion):');
    payload.weeklyPriorities.forEach((p) => lines.push(`- ${p}`));
  }
  return lines.join('\n');
}

function dailyToEntry(daily, index) {
  const dateStr = daily.date && /^\d{4}-\d{2}-\d{2}/.test(daily.date)
    ? daily.date.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const blob = [daily.context, ...(daily.good || []), ...(daily.bad || []), ...(daily.learning || [])].join(' ');
  const isMatch = /game|match|usta/i.test(blob);
  return {
    id: daily.id || `notion-${dateStr}-${index}`,
    date: `${dateStr}T17:00:00.000Z`,
    tags: daily.tags?.length ? daily.tags : inferTags(blob),
    intensity: daily.intensity ?? (isMatch ? 3 : 2),
    duration: daily.duration ?? (isMatch ? 90 : 75),
    notes: daily.notes || formatDailyNotes(daily),
    context: daily.context || '',
    source: 'notion',
  };
}

function buildSessionsFromNotion(payload) {
  if (!payload) return [];
  const raw = payload.sessions?.length
    ? payload.sessions
    : payload.latestDaily
      ? [payload.latestDaily]
      : [];
  return raw
    .map((d, i) => dailyToEntry(d, i))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildFocusFromNotion(payload) {
  if (!payload) return null;
  if (payload.focus?.cues?.length) {
    return { ...payload.focus, generated: payload.updatedAt || new Date().toISOString() };
  }

  const priorities = payload.weeklyPriorities || [];
  const latest = payload.latestDaily;
  const needs = [...(latest?.bad || []), ...(priorities || [])];

  const cues = needs.slice(0, 3).map((line) => {
    const short = line.split('—')[0].split(' - ')[0].trim();
    return short.length > 48 ? `${short.slice(0, 45)}…` : short;
  });

  while (cues.length < 3 && priorities[cues.length]) {
    const p = priorities[cues.length].split('—')[0].trim();
    cues.push(p.length > 48 ? `${p.slice(0, 45)}…` : p);
  }

  const fallbackCues = ['Stay loose', 'Watch contact', 'Recover behind baseline'];
  const finalCues = cues.length >= 2 ? cues : fallbackCues;

  const bodyParts = [];
  if (priorities.length) {
    bodyParts.push(
      `This week in Notion you're prioritizing ${priorities.slice(0, 3).join('; ')}.`,
    );
  }
  if (latest?.context) {
    bodyParts.push(
      `Latest session (${latest.date || 'recent'}): ${latest.context}. Build on what worked and address the needs-work items before you play again.`,
    );
  }
  if (!bodyParts.length) {
    bodyParts.push('Open your Notion practice insights page to add a daily reflection — the dashboard updates automatically.');
  }

  return {
    headline: finalCues[0],
    body: bodyParts.join(' '),
    cues: finalCues,
    generated: payload.updatedAt || new Date().toISOString(),
  };
}

function applyNotionPayload(payload) {
  const entries = buildSessionsFromNotion(payload);
  const focus = buildFocusFromNotion(payload);
  return {
    entries,
    focus,
    lastSession: entries[0]?.date || null,
  };
}

function loadNotionSyncMeta() {
  try {
    const raw = localStorage.getItem(NOTION_SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveNotionSyncMeta(meta) {
  try {
    localStorage.setItem(NOTION_SYNC_STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {}
}

async function fetchNotionInsights() {
  try {
    const res = await fetch('/api/notion-insights', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.sessions?.length || data?.latestDaily) {
        return { ...data, source: data.source || 'api' };
      }
    }
  } catch (e) {
    /* fallback */
  }
  const fallback = await fetch('notion-data.json', { cache: 'no-store' });
  if (!fallback.ok) throw new Error('Could not load Notion insights');
  const data = await fallback.json();
  return { ...data, source: 'snapshot' };
}

function useNotionInsights() {
  const [payload, setPayload] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotionInsights();
      setPayload(data);
      saveNotionSyncMeta({
        updatedAt: data.updatedAt,
        importedAt: new Date().toISOString(),
        source: data.source,
      });
      return data;
    } catch (e) {
      setError(e.message || 'Sync failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const dashboard = React.useMemo(
    () => (payload ? applyNotionPayload(payload) : null),
    [payload],
  );

  return {
    payload,
    loading,
    error,
    refresh,
    dashboard,
    notesDraft: payload ? formatNotionNotes(payload) : '',
    weeklyPriorities: payload?.weeklyPriorities || [],
  };
}

window.useNotionInsights = useNotionInsights;
window.formatNotionNotes = formatNotionNotes;
window.fetchNotionInsights = fetchNotionInsights;
window.buildSessionsFromNotion = buildSessionsFromNotion;
window.buildFocusFromNotion = buildFocusFromNotion;
window.applyNotionPayload = applyNotionPayload;
