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

/** Skill areas ranked from all Notion notes (priorities + session reflections). */
const IMPROVEMENT_AREA_RULES = [
  { key: 'volley', title: 'Volley', category: 'volley', re: /volley|volleys|net play|at the net/i },
  { key: 'serve', title: 'Serve', category: 'serve', re: /serve|serving|double fault|2nd serve|second serve|toss|kick serve/i },
  { key: 'overhead', title: 'Overhead', category: 'overhead', re: /overhead|smash|smashes/i },
  {
    key: 'groundstrokes',
    title: 'Ground Strokes',
    category: 'groundstrokes',
    re: /ground|baseline|rally|forehand|backhand|stroke|slice|corner|lob|high ball|pace|topspin|down the line|crosscourt/i,
  },
  {
    key: 'mental',
    title: 'Court IQ & Patterns',
    category: 'mental',
    re: /approach|no.?man|anticipat|confidence|focus|recovery|game point|hesitat|commit|mental|pattern|dictate/i,
  },
  { key: 'return', title: 'Return of Serve', category: 'serve', re: /return on serve|return serve|returning/i },
];

const TIP_RESOURCES = {
  volley: [
    { label: 'Backhand volley technique', url: 'https://www.youtube.com/results?search_query=tennis+backhand+volley+footwork+drill', type: 'youtube' },
    { label: 'First volley deep (not a winner)', url: 'https://www.youtube.com/results?search_query=tennis+approach+shot+first+volley+placement', type: 'youtube' },
    { label: 'USTA — Volley basics', url: 'https://www.usta.com/en/home/improve/tips-and-instruction/national/volley-basics.html', type: 'article' },
  ],
  serve: [
    { label: 'Second serve kick & spin', url: 'https://www.youtube.com/results?search_query=tennis+second+serve+topspin+kick+drill', type: 'youtube' },
    { label: 'Consistent toss routine', url: 'https://www.youtube.com/results?search_query=tennis+serve+toss+consistency+drill', type: 'youtube' },
    { label: 'Return position on slow serves', url: 'https://www.youtube.com/results?search_query=tennis+return+second+serve+inside+baseline', type: 'youtube' },
  ],
  overhead: [
    { label: 'Overhead footwork (run behind)', url: 'https://www.youtube.com/results?search_query=tennis+overhead+footwork+run+behind+ball', type: 'youtube' },
    { label: 'Smash contact in front', url: 'https://www.youtube.com/results?search_query=tennis+overhead+smash+contact+point+drill', type: 'youtube' },
    { label: 'Essential Tennis — Overheads', url: 'https://www.youtube.com/results?search_query=Essential+Tennis+overhead+smash', type: 'youtube' },
  ],
  groundstrokes: [
    { label: 'High ball — prepare early', url: 'https://www.youtube.com/results?search_query=tennis+high+ball+forehand+backhand+on+rise', type: 'youtube' },
    { label: 'Change pace vs heavy topspin', url: 'https://www.youtube.com/results?search_query=tennis+change+pace+rally+defense', type: 'youtube' },
    { label: 'Forehand slice fundamentals', url: 'https://www.youtube.com/results?search_query=tennis+forehand+slice+technique+beginner', type: 'youtube' },
  ],
  mental: [
    { label: 'Recover from no-man\'s zone', url: 'https://www.youtube.com/results?search_query=tennis+approach+shot+recovery+net+or+baseline', type: 'youtube' },
    { label: 'Approach shot patterns', url: 'https://www.youtube.com/results?search_query=tennis+approach+shot+drill+service+box', type: 'youtube' },
    { label: 'Intuitive Tennis — Match patterns', url: 'https://www.youtube.com/results?search_query=Intuitive+Tennis+match+patterns+amateur', type: 'youtube' },
  ],
  return: [
    { label: 'Return drills — short second serves', url: 'https://www.youtube.com/results?search_query=tennis+return+of+serve+drill+short+ball', type: 'youtube' },
    { label: 'Split-step return timing', url: 'https://www.youtube.com/results?search_query=tennis+return+split+step+timing', type: 'youtube' },
  ],
};

function collectNotionImprovementLines(payload) {
  if (!payload) return [];
  const lines = [];

  (payload.weeklyPriorities || []).forEach((text, i) => {
    lines.push({ text, kind: 'priority', weight: 6, recency: 1 - i * 0.05 });
  });

  if (payload.weeklyOverview?.focus) {
    payload.weeklyOverview.focus.split(/[;,]/).forEach((part) => {
      const text = part.trim();
      if (text) lines.push({ text, kind: 'overview', weight: 5, recency: 1 });
    });
  }

  const sessions = [...(payload.sessions || [])].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
  );
  sessions.forEach((s, i) => {
    const recency = Math.max(0.35, 1 - i * 0.06);
    (s.bad || []).forEach((text) => lines.push({ text, kind: 'needs', weight: 4, recency }));
    (s.learning || []).forEach((text) => lines.push({ text, kind: 'learning', weight: 3, recency }));
    (s.good || []).forEach((text) => lines.push({ text, kind: 'win', weight: 1.5, recency }));
  });

  if (payload.latestDaily && !sessions.some((s) => s.date === payload.latestDaily.date)) {
    const d = payload.latestDaily;
    const recency = 1.1;
    (d.bad || []).forEach((text) => lines.push({ text, kind: 'needs', weight: 4.5, recency }));
    (d.learning || []).forEach((text) => lines.push({ text, kind: 'learning', weight: 3, recency }));
    (d.good || []).forEach((text) => lines.push({ text, kind: 'win', weight: 1.5, recency }));
  }

  return lines;
}

function matchImprovementAreas(text) {
  return IMPROVEMENT_AREA_RULES.filter((rule) => rule.re.test(text));
}

function rankTopImprovementAreas(payload, limit = 5) {
  const scores = {};
  const quotes = {};
  const lines = collectNotionImprovementLines(payload);

  lines.forEach(({ text, weight, recency }) => {
    const matched = matchImprovementAreas(text);
    if (!matched.length) {
      const fallback = IMPROVEMENT_AREA_RULES.find((r) => r.key === 'groundstrokes');
      matched.push(fallback);
    }
    matched.forEach((rule) => {
      scores[rule.key] = (scores[rule.key] || 0) + weight * recency;
      if (!quotes[rule.key]) quotes[rule.key] = [];
      if (quotes[rule.key].length < 4 && !quotes[rule.key].includes(text)) {
        quotes[rule.key].push(text);
      }
    });
  });

  return IMPROVEMENT_AREA_RULES.map((rule) => ({
    ...rule,
    score: scores[rule.key] || 0,
    notionQuotes: quotes[rule.key] || [],
  }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function pickTipsForArea(area, notionQuotes, tipsLib, refreshSeed = 0) {
  const items = tipsLib?.[area.category]?.items || [];
  if (!items.length) return [];
  const blob = notionQuotes.join(' ').toLowerCase();

  const scored = items.map((tip, idx) => {
    let score = tip.priority ? 3 : 0;
    const hay = `${tip.h} ${tip.p} ${tip.drill}`.toLowerCase();
    notionQuotes.forEach((q) => {
      q.toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4)
        .forEach((w) => {
          if (hay.includes(w) || blob.includes(w)) score += 2;
        });
    });
    return { tip, idx, score };
  });

  scored.sort((a, b) => b.score - a.score || (a.idx + refreshSeed) % items.length - (b.idx + refreshSeed) % items.length);
  const picked = [];
  const seen = new Set();
  scored.forEach(({ tip }) => {
    if (picked.length >= 3 || seen.has(tip.h)) return;
    seen.add(tip.h);
    picked.push(tip);
  });
  return picked;
}

function summarizeAreaFromNotion(area, notionQuotes) {
  if (!notionQuotes.length) {
    return tipsLibBlurb(area.category);
  }
  const lead = notionQuotes[0].split('—')[0].split(' - ')[0].trim();
  const more = notionQuotes.length > 1 ? ` You also noted: ${notionQuotes.slice(1, 3).join('; ')}.` : '';
  return `From your Notion notes: ${lead}.${more}`;
}

function tipsLibBlurb(category) {
  const blurbs = {
    volley: 'Net game and volley patterns keep showing up in your reflections.',
    serve: 'Serve consistency — especially second serves — is a recurring theme.',
    overhead: 'Overhead footwork and contact are active improvement targets.',
    groundstrokes: 'Baseline depth, pace changes, and corner play need reps.',
    mental: 'Court position, commitment, and approach patterns need deliberate practice.',
  };
  return blurbs[category] || 'Keep building reps in this area.';
}

function normalizeNoteKey(note) {
  return note.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 64);
}

function condenseCheatNote(note, maxLen = 120) {
  const trimmed = note.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}

function dedupeNotes(notes) {
  const out = [];
  const seen = new Set();
  for (const note of notes || []) {
    const key = normalizeNoteKey(note);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(note);
  }
  return out;
}

function summarizeNoteList(notes, maxItems = 3) {
  const unique = dedupeNotes(notes);
  if (!unique.length) return [];
  if (unique.length === 1) return [condenseCheatNote(unique[0])];

  const latest = unique[unique.length - 1];
  const earlier = unique.slice(0, -1);
  const merged = [condenseCheatNote(latest)];

  const themes = new Set();
  for (const note of earlier.reverse()) {
    const tokens = normalizeNoteKey(note).split(' ').filter((t) => t.length > 3);
    const theme = tokens.slice(0, 3).join(' ');
    if (themes.has(theme)) continue;
    themes.add(theme);
    merged.push(condenseCheatNote(note, 96));
    if (merged.length >= maxItems) break;
  }

  return merged.slice(0, maxItems);
}

function buildCheatNotesFromNotion(payload) {
  if (!payload?.cheatNotes?.length) {
    return { players: [], generatedAt: payload?.updatedAt || null, source: payload?.source || null };
  }

  const players = payload.cheatNotes
    .map((row) => {
      const goodRaw = dedupeNotes(row.good || []);
      const badRaw = dedupeNotes(row.bad || []).filter(
        (note) => !goodRaw.some((g) => normalizeNoteKey(g) === normalizeNoteKey(note)),
      );
      const goodAt = summarizeNoteList(goodRaw, 3);
      const badAt = summarizeNoteList(badRaw, 3);
      const summaryParts = [];
      if (goodAt.length) summaryParts.push(`Strengths: ${goodAt.join('; ')}`);
      if (badAt.length) summaryParts.push(`Exploit: ${badAt.join('; ')}`);
      return {
        name: row.name,
        goodAt,
        badAt,
        summary: summaryParts.join(' · '),
        sessionCount: goodRaw.length + badRaw.length,
      };
    })
    .filter((p) => p.goodAt.length || p.badAt.length)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    players,
    generatedAt: payload.updatedAt || new Date().toISOString(),
    source: payload.source || 'notion',
    playerCount: players.length,
  };
}

function buildSharpenFromNotion(payload, tipsLib, refreshSeed = 0) {
  const lib = tipsLib || (typeof TIPS !== 'undefined' ? TIPS : null) || window.TIPS;
  if (!payload || !lib) {
    return { areas: [], generatedAt: null, source: null };
  }

  const ranked = rankTopImprovementAreas(payload, 5);
  const areas = ranked.map((area, index) => {
    const notionQuotes = area.notionQuotes.slice(0, 3);
    const tips = pickTipsForArea(area, notionQuotes, lib, refreshSeed + index);
    const resources = [
      ...(TIP_RESOURCES[area.key] || TIP_RESOURCES[area.category] || []),
    ].slice(0, 4);

    return {
      rank: index + 1,
      key: area.key,
      title: area.title,
      category: area.category,
      score: Math.round(area.score),
      notionQuotes,
      summary: summarizeAreaFromNotion(area, notionQuotes),
      tips: tips.map((t) => ({
        h: t.h,
        p: t.p,
        drill: t.drill,
        priority: Boolean(t.priority),
      })),
      resources,
    };
  });

  return {
    areas,
    generatedAt: payload.updatedAt || new Date().toISOString(),
    source: payload.source || 'notion',
    sessionCount: payload.sessions?.length || 0,
  };
}

window.useNotionInsights = useNotionInsights;
window.formatNotionNotes = formatNotionNotes;
window.fetchNotionInsights = fetchNotionInsights;
window.buildSessionsFromNotion = buildSessionsFromNotion;
window.buildFocusFromNotion = buildFocusFromNotion;
window.applyNotionPayload = applyNotionPayload;
window.buildSharpenFromNotion = buildSharpenFromNotion;
window.buildCheatNotesFromNotion = buildCheatNotesFromNotion;
window.rankTopImprovementAreas = rankTopImprovementAreas;
