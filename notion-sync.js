/* global React */
/**
 * Notion is the source of truth for sessions, stats, and today's focus brief.
 */
const NOTION_SYNC_STORAGE_KEY = 'tennis-notion-sync-v1';
const NOTION_PAYLOAD_CACHE_KEY = 'tennis-notion-payload-v1';
let notionFetchInFlight = null;

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
  const fallbackDuration = isMatch ? 90 : 75;
  const resolveDuration = window.resolveSessionDuration || ((d, fb) => d?.duration ?? fb);
  return {
    id: daily.id || `notion-${dateStr}-${index}`,
    date: `${dateStr}T17:00:00.000Z`,
    tags: daily.tags?.length ? daily.tags : inferTags(blob),
    intensity: daily.intensity ?? (isMatch ? 3 : 2),
    duration: resolveDuration(daily, fallbackDuration),
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

  const prev = payload.previousWeekFocus;
  const needsImprovement = (prev?.needsImprovement || [])
    .map((line) => String(line).replace(/^\*+/, '').trim())
    .filter(Boolean);
  const thingsToTry = (prev?.thingsToTry || [])
    .map((line) => String(line).replace(/^\*+/, '').trim())
    .filter(Boolean);

  if (needsImprovement.length || thingsToTry.length) {
    const headline = thingsToTry[0] || needsImprovement[0] || 'Weekly focus from Notion';
    const sections = [];
    if (needsImprovement.length) {
      sections.push({ title: 'Needs improvement', items: needsImprovement });
    }
    if (thingsToTry.length) {
      sections.push({ title: 'Things to try', items: thingsToTry });
    }
    const weekLabel = prev?.weekLabel || 'last week';
    const body = prev?.isPreviousWeek === false
      ? `Only one weekly log found in Notion — showing ${weekLabel}.`
      : `From ${weekLabel} in Notion — carry these into this week's practice.`;

    return {
      headline: String(headline).replace(/^\*+/, '').trim(),
      body,
      cues: [],
      sections,
      weekLabel,
      generated: payload.updatedAt || new Date().toISOString(),
    };
  }

  if (payload.focus?.cues?.length && !payload.weeklyPriorities?.length) {
    return { ...payload.focus, generated: payload.updatedAt || new Date().toISOString() };
  }

  return {
    headline: 'Weekly focus from Notion',
    body: 'Add Needs improvement and Things to try under last week\'s log in Notion — the card updates on refresh.',
    cues: [],
    sections: [],
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

function loadNotionPayloadCache() {
  try {
    const raw = localStorage.getItem(NOTION_PAYLOAD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveNotionPayloadCache(data) {
  try {
    localStorage.setItem(
      NOTION_PAYLOAD_CACHE_KEY,
      JSON.stringify({ data, savedAt: Date.now() }),
    );
  } catch (e) {}
}

function applyCachedNotionState(cached) {
  if (!cached?.data || !isValidNotionPayload(cached.data)) return null;
  const applied = applyNotionPayload(cached.data);
  return {
    payload: cached.data,
    entries: applied.entries,
    focus: applied.focus,
    lastSession: applied.lastSession,
    notionUpdatedAt: cached.data.updatedAt,
    notionSource: cached.data.source,
    notionError: cached.data.syncWarning || cached.data.apiError || null,
  };
}

function isValidNotionPayload(data) {
  if (!data || data.error) return false;
  return Boolean(
    data.updatedAt ||
    data.sessions?.length ||
    data.latestDaily ||
    data.cheatNotes?.length ||
    data.weeklyPriorities?.length,
  );
}

async function fetchNotionInsights({ force = false } = {}) {
  if (notionFetchInFlight) return notionFetchInFlight;

  notionFetchInFlight = (async () => {
    let apiFailure = null;

    try {
      const res = await fetch(
        `/api/notion-insights?t=${Date.now()}${force ? '&force=1' : ''}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json();
        if (isValidNotionPayload(data)) {
          saveNotionPayloadCache(data);
          saveNotionSyncMeta({
            updatedAt: data.updatedAt,
            importedAt: new Date().toISOString(),
            source: data.source,
          });
          return { ...data, source: data.source || 'api' };
        }
        apiFailure = data?.apiError || data?.error || 'Notion API returned an empty payload';
      } else {
        const errText = await res.text().catch(() => '');
        apiFailure = errText || `Notion API error (${res.status})`;
      }
    } catch (e) {
      apiFailure = e.message || 'Could not reach Notion API';
    }

    const cached = loadNotionPayloadCache();
    if (cached?.data && isValidNotionPayload(cached.data)) {
      return {
        ...cached.data,
        source: cached.data.source || 'cache',
        apiError: apiFailure || cached.data.apiError || null,
        syncWarning:
          cached.data.syncWarning
          || (apiFailure ? 'Live Notion API unavailable — showing cached data' : null),
      };
    }

    const fallback = await fetch(`notion-data.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!fallback.ok) throw new Error(apiFailure || 'Could not load Notion insights');
    const data = await fallback.json();
    return {
      ...data,
      source: 'snapshot',
      cheatNotesSource: 'snapshot',
      weeklySource: 'snapshot',
      apiError: apiFailure || data.apiError || null,
      syncWarning:
        data.syncWarning
        || (apiFailure ? 'Live Notion API unavailable — showing offline snapshot' : null),
    };
  })();

  try {
    return await notionFetchInFlight;
  } finally {
    notionFetchInFlight = null;
  }
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
  { key: 'volley', title: 'Volley', category: 'volley', re: /volley|vlley|volleys|net play|at the net|approach shot/i },
  { key: 'serve', title: 'Serve', category: 'serve', re: /serve|serving|double fault|1st serve|first serve|2nd serve|second serve|toss|kick serve|top.?spin|side.?spin/i },
  { key: 'overhead', title: 'Overhead', category: 'overhead', re: /overhead|smash|smashes/i },
  {
    key: 'groundstrokes',
    title: 'Ground Strokes',
    category: 'groundstrokes',
    re: /ground|groundstroke|baseline|rally|forehand|backhand|stroke|slice|corner|lob|high ball|pace|topspin|down the line|crosscourt|form on wall/i,
  },
  {
    key: 'mental',
    title: 'Court IQ & Patterns',
    category: 'mental',
    re: /approach|no.?man|anticipat|confidence|focus|recovery|game point|hesitat|commit|mental|pattern|dictate|success rate/i,
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
    lines.push({ text, kind: 'priority', weight: 20, recency: 1 - i * 0.02 });
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

function areaMatchesLine(area, text) {
  const matched = matchImprovementAreas(text);
  if (!matched.length) return area.key === 'groundstrokes';
  return matched.some((rule) => rule.key === area.key);
}

/** Weekly priorities and latest session notes first — so new Notion edits surface immediately. */
function mergeAreaNotionQuotes(area, rankedQuotes, payload) {
  const out = [];
  const seen = new Set();
  const push = (text) => {
    const t = String(text || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  (payload.weeklyPriorities || []).forEach((text) => {
    if (areaMatchesLine(area, text)) push(text);
  });

  if (payload.weeklyOverview?.focus) {
    payload.weeklyOverview.focus.split(/[;,]/).forEach((part) => {
      const text = part.trim();
      if (text && areaMatchesLine(area, text)) push(text);
    });
  }

  const latest = payload.latestDaily || payload.sessions?.[0];
  if (latest) {
    if (latest.context && areaMatchesLine(area, latest.context)) push(latest.context);
    [...(latest.bad || []), ...(latest.learning || []), ...(latest.good || [])].forEach((text) => {
      if (areaMatchesLine(area, text)) push(text);
    });
  }

  (rankedQuotes || []).forEach(push);
  return out.slice(0, 4);
}

function notionPayloadRevision(payload) {
  if (!payload) return '';
  const priorities = (payload.weeklyPriorities || []).join('\n');
  const overview = `${payload.weeklyOverview?.focus || ''}|${payload.weeklyOverview?.drill || ''}`;
  const prev = payload.previousWeekFocus;
  const prevBlob = prev
    ? [...(prev.needsImprovement || []), ...(prev.thingsToTry || [])].join('\n')
    : '';
  const latest = payload.latestDaily || payload.sessions?.[0];
  const latestBlob = latest
    ? [
        latest.date || '',
        latest.context || '',
        ...(latest.bad || []),
        ...(latest.learning || []),
        ...(latest.good || []),
      ].join('\n')
    : '';
  return `${payload.updatedAt || ''}:${priorities}:${overview}:${prevBlob}:${latestBlob}`;
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

function rankSharpenAreas(payload, limit = 5) {
  const byKey = new Map();
  const order = [];

  const addArea = (rule, scoreBoost = 0) => {
    if (!rule || byKey.has(rule.key)) return;
    byKey.set(rule.key, { ...rule, score: scoreBoost, notionQuotes: [] });
    order.push(rule.key);
  };

  (payload.weeklyPriorities || []).forEach((text, i) => {
    const matched = matchImprovementAreas(text);
    const rules = matched.length
      ? matched
      : [IMPROVEMENT_AREA_RULES.find((r) => r.key === 'groundstrokes')];
    rules.forEach((rule) => addArea(rule, 200 - i * 10));
  });

  if (payload.weeklyOverview?.focus) {
    payload.weeklyOverview.focus.split(/[;,]/).forEach((part, i) => {
      const text = part.trim();
      if (!text) return;
      matchImprovementAreas(text).forEach((rule) => addArea(rule, 150 - i * 5));
    });
  }

  const historical = rankTopImprovementAreas(payload, limit * 2);
  for (const area of historical) {
    if (byKey.has(area.key)) {
      const existing = byKey.get(area.key);
      existing.score += area.score;
      existing.notionQuotes = area.notionQuotes;
    } else {
      byKey.set(area.key, { ...area });
      order.push(area.key);
    }
  }

  return order
    .map((key) => byKey.get(key))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function tokenizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function quoteToTipHeading(quote) {
  const cleaned = String(quote || '').replace(/^\*+/, '').trim();
  const short = cleaned.split(/[—–\-:;]/)[0].trim();
  if (short.length <= 56) return short;
  return `${short.slice(0, 53).trim()}…`;
}

function quoteToTipBody(quote) {
  const cleaned = String(quote || '').replace(/^\*+/, '').trim();
  return `Your current Notion focus — build today's reps around this: ${cleaned}`;
}

function pickDrillForQuote(quote, area, lib, payload) {
  const libTips = lib?.[area.category]?.items || [];
  const tokens = tokenizeForMatch(quote);
  let bestDrill = null;
  let bestScore = 0;

  for (const tip of libTips) {
    const hay = `${tip.h} ${tip.p} ${tip.drill}`.toLowerCase();
    let score = 0;
    tokens.forEach((w) => {
      if (hay.includes(w)) score += 2;
    });
    if (score > bestScore) {
      bestScore = score;
      bestDrill = tip.drill;
    }
  }

  if (bestDrill) return bestDrill;
  if (payload?.weeklyOverview?.drill) return payload.weeklyOverview.drill;
  return '15 min of deliberate reps — quality over volume';
}

function buildAreaTips(area, notionQuotes, payload, lib, refreshSeed = 0) {
  const fromNotion = notionQuotes.slice(0, 3).map((quote, i) => ({
    h: quoteToTipHeading(quote),
    p: quoteToTipBody(quote),
    drill: pickDrillForQuote(quote, area, lib, payload),
    priority: i === 0,
    fromNotion: true,
  }));

  if (fromNotion.length >= 3) return fromNotion;

  const usedHeadings = new Set(fromNotion.map((t) => t.h.toLowerCase()));
  const libraryPicks = pickTipsForArea(area, notionQuotes, lib, refreshSeed)
    .filter((t) => !usedHeadings.has(t.h.toLowerCase()))
    .map((t) => ({
      h: t.h,
      p: t.p,
      drill: t.drill,
      priority: Boolean(t.priority),
      fromNotion: false,
    }));

  return [...fromNotion, ...libraryPicks].slice(0, 3);
}

function pickTipsForArea(area, notionQuotes, tipsLib, refreshSeed = 0) {
  const items = tipsLib?.[area.category]?.items || [];
  if (!items.length) return [];
  const blob = notionQuotes.join(' ').toLowerCase();
  const hasNotionFocus = notionQuotes.length > 0;

  const scored = items.map((tip, idx) => {
    let score = hasNotionFocus ? 0 : (tip.priority ? 3 : 0);
    const hay = `${tip.h} ${tip.p} ${tip.drill}`.toLowerCase();
    notionQuotes.forEach((q) => {
      tokenizeForMatch(q).forEach((w) => {
        if (hay.includes(w)) score += 3;
        if (blob.includes(w)) score += 1;
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
    const key = String(note || '').trim().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(note);
  }
  return out;
}

function formatCheatNoteLine(note, maxLen = 320) {
  const trimmed = String(note || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return condenseCheatNote(trimmed, maxLen);
}

function buildCheatSummary(goodAt, badAt) {
  const parts = [];
  if (goodAt.length) {
    const strengths = goodAt.slice(0, 2).join(' · ');
    parts.push(`Strengths: ${strengths}`);
  }
  if (badAt.length) {
    const exploits = badAt.slice(0, 2).join(' · ');
    parts.push(`Exploit: ${exploits}`);
  }
  if (goodAt.length > 2) parts.push(`+${goodAt.length - 2} more strength notes`);
  if (badAt.length > 2) parts.push(`+${badAt.length - 2} more exploit notes`);
  return parts.join(' · ');
}

function isExcludedCheatPlayer(name) {
  return /^ball\s*machine$/i.test(String(name || '').trim());
}

/** Display labels for opponent cards (canonical Notion keys → shown title). */
const PLAYER_DISPLAY_NAMES = {
  Coach: 'Coach (Michael G)',
  Jessika: 'Jessika W',
};

function getPlayerDisplayName(name) {
  const key = String(name || '').trim();
  return PLAYER_DISPLAY_NAMES[key] || key;
}

function buildCheatNotesFromNotion(payload) {
  if (!payload?.cheatNotes?.length) {
    return {
      players: [],
      generatedAt: payload?.updatedAt || null,
      source: payload?.source || null,
      playerCount: 0,
      totalNoteCount: 0,
    };
  }

  const players = payload.cheatNotes
    .filter((row) => !isExcludedCheatPlayer(row.name))
    .map((row) => {
      const goodRaw = dedupeNotes(row.good || []);
      const badRaw = dedupeNotes(row.bad || []);
      const goodAt = goodRaw.map((n) => formatCheatNoteLine(n)).filter(Boolean);
      const badAt = badRaw.map((n) => formatCheatNoteLine(n)).filter(Boolean);
      return {
        name: getPlayerDisplayName(row.name),
        goodAt,
        badAt,
        summary: buildCheatSummary(goodAt, badAt),
        sessionCount: goodAt.length + badAt.length,
      };
    })
    .filter((p) => p.goodAt.length || p.badAt.length)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalNoteCount = players.reduce((sum, p) => sum + p.goodAt.length + p.badAt.length, 0);

  return {
    players,
    generatedAt: payload.updatedAt || new Date().toISOString(),
    source: payload.source || 'notion',
    playerCount: players.length,
    totalNoteCount,
    cheatNotesSource: payload.cheatNotesSource || payload.source || null,
  };
}

function buildSharpenFromNotion(payload, tipsLib, refreshSeed = 0) {
  const lib = tipsLib || (typeof TIPS !== 'undefined' ? TIPS : null) || window.TIPS;
  if (!payload || !lib) {
    return { areas: [], generatedAt: null, source: null };
  }

  const ranked = rankSharpenAreas(payload, 5);
  const areas = ranked.map((area, index) => {
    const notionQuotes = mergeAreaNotionQuotes(area, area.notionQuotes, payload);
    const tips = buildAreaTips(area, notionQuotes, payload, lib, refreshSeed + index);
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
        fromNotion: Boolean(t.fromNotion),
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
window.loadNotionPayloadCache = loadNotionPayloadCache;
window.applyCachedNotionState = applyCachedNotionState;
window.buildSessionsFromNotion = buildSessionsFromNotion;
window.buildFocusFromNotion = buildFocusFromNotion;
window.applyNotionPayload = applyNotionPayload;
window.buildSharpenFromNotion = buildSharpenFromNotion;
window.buildCheatNotesFromNotion = buildCheatNotesFromNotion;
window.getPlayerDisplayName = getPlayerDisplayName;
window.rankTopImprovementAreas = rankTopImprovementAreas;
window.notionPayloadRevision = notionPayloadRevision;
if (typeof window.groupEntriesByDate !== 'function') {
  window.groupEntriesByDate = (entries, limit = 3) => entries.slice(0, limit);
}
