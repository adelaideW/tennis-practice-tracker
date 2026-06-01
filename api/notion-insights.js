/**
 * Vercel serverless: live Notion fetch when NOTION_TOKEN is set.
 * Falls back to notion-data.json snapshot when unset.
 */
const PAGE_ID = process.env.NOTION_PAGE_ID || '32470a7de7e0803e9f3ad8904cf25efe';
const NOTION_VERSION = '2022-06-28';

function normalizeId(id) {
  const raw = id.replace(/-/g, '');
  if (raw.length !== 32) return id;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

async function notionFetch(path) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API ${res.status}: ${err}`);
  }
  return res.json();
}

async function notionFetchAllChildren(blockId) {
  const results = [];
  let cursor;
  do {
    const qs = new URLSearchParams({ page_size: '100' });
    if (cursor) qs.set('start_cursor', cursor);
    const data = await notionFetch(`/blocks/${blockId}/children?${qs}`);
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
}

async function loadSnapshot() {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const candidates = [
    join(process.cwd(), 'api', 'notion-data.json'),
    join(process.cwd(), 'notion-data.json'),
  ];
  for (const path of candidates) {
    try {
      const raw = await readFile(path, 'utf8');
      return { ...JSON.parse(raw), source: 'snapshot' };
    } catch (_) {
      /* try next path */
    }
  }
  throw new Error('notion-data.json snapshot missing');
}

function parseToggleLines(lines) {
  const good = [];
  const bad = [];
  const learning = [];
  let section = null;
  let context = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('context:')) {
      context = line.replace(/^context:\s*/i, '');
      continue;
    }
    if (lower.startsWith('context')) {
      section = 'context';
      continue;
    }
    if (lower === 'good:' || lower.startsWith('good')) {
      section = 'good';
      continue;
    }
    if (
      lower === 'bad:' ||
      lower.startsWith('bad') ||
      lower.startsWith('learning') ||
      lower.startsWith('to practice')
    ) {
      section = section === 'good' ? 'bad' : 'bad';
      if (lower.startsWith('learning')) section = 'learning';
      continue;
    }
    const bullet = line.replace(/^[-•]\s*/, '').trim();
    if (!bullet) continue;
    if (section === 'good') good.push(bullet);
    else if (section === 'learning') learning.push(bullet);
    else if (section === 'bad') bad.push(bullet);
    else if (section === 'context' && !context) context = bullet;
    else if (!context && !section) context = bullet;
  }

  return { context, good, bad, learning };
}

/** Parse every daily reflection toggle under "Daily reflection". */
async function parseAllDailySessions(pageId) {
  const blocks = await notionFetchAllChildren(pageId);
  const sessions = [];
  const LINE_BLOCK_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'paragraph']);
  const DAY_TITLE_RE = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;

  const collectLinesDeep = async (parentId) => {
    const out = [];
    const walk = async (items) => {
      for (const item of items) {
        if (LINE_BLOCK_TYPES.has(item.type)) {
          const line = blockPlainText(item);
          if (line) out.push(line);
        }
        if (item.has_children) {
          const nested = await notionFetchAllChildren(item.id);
          await walk(nested);
        }
      }
    };
    const top = await notionFetchAllChildren(parentId);
    await walk(top);
    return out;
  };

  const parseSessionToggle = async (toggleBlock) => {
    const title = blockPlainText(toggleBlock);
    if (!/\d{4}-\d{2}-\d{2}/.test(title) && !DAY_TITLE_RE.test(title)) {
      return;
    }
    const lines = await collectLinesDeep(toggleBlock.id);
    const parsed = parseToggleLines(lines);
    const dateMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : title;
    sessions.push({
      id: `notion-${date}`,
      date,
      label: title,
      context: parsed.context || title,
      good: parsed.good,
      bad: parsed.bad,
      learning: parsed.learning,
    });
  };

  const parseDailyContainer = async (containerId) => {
    const children = await notionFetchAllChildren(containerId);
    for (const child of children) {
      if (child.type !== 'toggle') continue;
      await parseSessionToggle(child);
    }
  };

  let inDailySection = false;

  for (const block of blocks) {
    if (block.type === 'heading_3') {
      const text = (block.heading_3?.rich_text || []).map((t) => t.plain_text).join('');
      if (/daily reflection/i.test(text)) {
        inDailySection = true;
        if (block.has_children) {
          await parseDailyContainer(block.id);
          inDailySection = false;
        }
      } else {
        inDailySection = false;
      }
      continue;
    }
    if (block.type === 'toggle') {
      const title = blockPlainText(block);
      if (/daily reflection/i.test(title)) {
        await parseDailyContainer(block.id);
        inDailySection = false;
        continue;
      }
      if (!inDailySection) continue;
      await parseSessionToggle(block);
    }
  }

  sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
  return sessions;
}

const WEEKLY_LINE_BLOCK_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'paragraph']);

/** Latest "Week of …" block under Weekly insights → priorities + overview focus/drill. */
async function parseWeeklyPriorities(pageId) {
  const blocks = await notionFetchAllChildren(pageId);
  let weeklyContainerId = null;

  for (const block of blocks) {
    const text = blockPlainText(block);
    if (!/weekly\s+insights/i.test(text)) continue;
    if (block.has_children) {
      weeklyContainerId = block.id;
      break;
    }
  }

  if (!weeklyContainerId) return null;

  const weekToggles = (await notionFetchAllChildren(weeklyContainerId)).filter(
    (b) => b.type === 'toggle' && /^week\s+of\b/i.test(blockPlainText(b)),
  );
  if (!weekToggles.length) return null;

  const latestWeek = weekToggles[0];
  const weekChildren = await notionFetchAllChildren(latestWeek.id);
  const overview = { focus: '', drill: '' };
  const priorities = [];

  for (const child of weekChildren) {
    if (child.type !== 'toggle') continue;
    const title = blockPlainText(child);

    if (/^overview$/i.test(title)) {
      const lines = await collectWeeklyLines(child.id);
      for (const line of lines) {
        const cleaned = line.replace(/^[-•]\s*/, '').trim();
        const focusM = cleaned.match(/^focus:\s*(.+)$/i);
        const drillM = cleaned.match(/^drill:\s*(.+)$/i);
        if (focusM) overview.focus = focusM[1].trim();
        if (drillM) overview.drill = drillM[1].trim();
      }
      continue;
    }

    if (/things to (?:do\/try|try).*priorit/i.test(title)) {
      const bullets = await collectTopLevelBullets(child.id);
      for (const text of bullets) {
        const trimmed = text.trim();
        if (trimmed && !priorities.includes(trimmed)) priorities.push(trimmed);
      }
    }
  }

  return {
    weekLabel: blockPlainText(latestWeek),
    weeklyPriorities: priorities,
    weeklyOverview: overview,
  };
}

async function collectWeeklyLines(parentId) {
  const out = [];
  const children = await notionFetchAllChildren(parentId);
  for (const item of children) {
    if (WEEKLY_LINE_BLOCK_TYPES.has(item.type)) {
      const line = blockPlainText(item);
      if (line) out.push(line);
    }
  }
  return out;
}

async function collectTopLevelBullets(parentId) {
  const out = [];
  const children = await notionFetchAllChildren(parentId);
  for (const item of children) {
    if (item.type === 'bulleted_list_item' || item.type === 'numbered_list_item') {
      const text = blockPlainText(item);
      if (text) out.push(text);
    }
  }
  return out;
}

function blockPlainText(block) {
  const type = block.type;
  const data = block[type];
  if (!data?.rich_text) return '';
  return data.rich_text.map((t) => t.plain_text).join('').trim();
}

const CHEAT_LINE_BLOCK_TYPES = new Set([
  'bulleted_list_item',
  'numbered_list_item',
  'paragraph',
  'heading_3',
]);

const GOOD_SECTION_RE = /^(good(\s+at)?|strengths)\s*:?\s*$/i;
const BAD_SECTION_RE = /^(loophole|bad|weakness(es)?|needs?\s*work|exploit)\s*:?\s*$/i;
const ANALYSIS_TITLE_RE = /analysis on other/i;
const PLAYER_STYLE_ANALYSIS_RE = /analysis on\s+(.+?)['’]?\s+s?\s+play style/i;
const MY_PERFORMANCE_RE =
  /\b(?:analysis\s+(?:on|of)\s+my(?:\s+performance|\s+game)?|my\s+(?:performance|game|weakness(?:es)?|notes)|personal\s+weakness(?:es)?|myself)\b/i;

const PLAYER_ALIASES = {
  Jessy: 'Jessie',
  Jessie: 'Jessie',
  coach: 'Coach',
};

/** Practice equipment / session labels — not opponents for game cheat notes. */
const EXCLUDED_CHEAT_PLAYER_RE = /^ball\s*machine$/i;

function isExcludedCheatPlayer(name) {
  return EXCLUDED_CHEAT_PLAYER_RE.test(String(name || '').trim());
}

function normalizePlayerName(name) {
  const t = name.trim();
  return PLAYER_ALIASES[t] || t;
}

function extractPlayerFromAnalysisTitle(text) {
  const title = String(text || '').trim();
  const m = title.match(PLAYER_STYLE_ANALYSIS_RE);
  if (!m?.[1]) return null;
  const candidate = m[1].trim().replace(/^other\s+/i, '').replace(/\s+/g, ' ');
  return isLikelyPlayerName(candidate) ? candidate : null;
}

function classifyObservedNote(note) {
  const lower = note.trim().toLowerCase();
  if (/^(good|strong|great|excellent|very good)\b/.test(lower)) return 'good';
  if (/^(loophole|weak|bad|needs improvement)\b/.test(lower)) return 'bad';
  const badSignals =
    /\b(weak|not |lack |doesn'?t|errors?|unstable|slow|miss|struggle|late|prone|hesitate|tend to miss|into the net|mostly out|hard time|not enough|not very|not as|not consistent)\b/;
  return badSignals.test(lower) ? 'bad' : 'good';
}

function pushNote(byPlayer, name, note, section) {
  const trimmedName = normalizePlayerName(name);
  const trimmedNote = note.trim().replace(/,\s*$/, '');
  if (!trimmedName || !trimmedNote || isExcludedCheatPlayer(trimmedName)) return;
  if (/^(good|loophole|bad|overview|focus|drill)$/i.test(trimmedName)) return;
  if (!byPlayer.has(trimmedName)) {
    byPlayer.set(trimmedName, { name: trimmedName, good: [], bad: [] });
  }
  const row = byPlayer.get(trimmedName);
  const list = section === 'good' ? row.good : row.bad;
  if (!list.includes(trimmedNote)) list.push(trimmedNote);
}

function parsePlayerLine(line, section, byPlayer) {
  const trimmed = line.trim().replace(/^[-•]\s*/, '');
  if (!trimmed) return { section, consumed: false };

  if (GOOD_SECTION_RE.test(trimmed)) return { section: 'good', consumed: true };
  if (BAD_SECTION_RE.test(trimmed)) return { section: 'bad', consumed: true };

  if (!section) return { section, consumed: false };

  const colon = trimmed.match(/^([^:]{1,40}):\s*(.+)$/);
  if (colon) {
    pushNote(byPlayer, colon[1], colon[2], section);
    return { section, consumed: true };
  }

  const dash = trimmed.match(/^([^—\-]{1,40})\s*[-—]\s*(.+)$/);
  if (dash) {
    pushNote(byPlayer, dash[1], dash[2], section);
    return { section, consumed: true };
  }

  return { section, consumed: false };
}

function isLikelyPlayerName(text) {
  const t = text.trim();
  if (!t || t.length > 24 || isExcludedCheatPlayer(t)) return false;
  if (GOOD_SECTION_RE.test(t) || BAD_SECTION_RE.test(t)) return false;
  if (/analysis|weekly|insight|reflection|overview|things to/i.test(t)) return false;
  if (/^(duration|played|focus|drill|practice|game|serve|volley)$/i.test(t)) return false;
  if (
    /^(always|heavy|consistent|lack|fast|high|weak|movement|speedy|take|does|not|top|spin|forehand|backhand|lob|volley|serve|return|baseline|court|ball|good|bad)/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/^[A-Z]{2,4}$/.test(t)) return true;
  const words = t.split(/\s+/);
  if (words.length > 2) return false;
  if (words.length === 1) return /^[A-Z][a-z]{1,20}$/.test(t);
  return /^[A-Z][a-z]+\s+[A-Z]\.?$/.test(t) || /^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(t);
}

function isPlayerAnalysisTitle(title) {
  const t = String(title || '').trim();
  return ANALYSIS_TITLE_RE.test(t) || PLAYER_STYLE_ANALYSIS_RE.test(t);
}

function isUserPlanNote(line) {
  const cleaned = String(line || '').trim();
  return /^\*/.test(cleaned) || /\*(be prepared|needs to|try to|remember to)\b/i.test(cleaned);
}

/** Ingest Good / Loophole notes from explicit analysis block subtrees only. */
async function ingestPlayerAnalysisBlock(parentId, byPlayer, parentTitle = '') {
  let section = null;
  let inOtherAnalysis = isPlayerAnalysisTitle(parentTitle);
  const rootPlayer = extractPlayerFromAnalysisTitle(parentTitle);
  const SESSION_TOGGLE_RE =
    /(\d{4}-\d{2}-\d{2})|^(mon|tue|wed|thu|fri|sat|sun)(day)?\b/i;

  const resetPlayerContext = () => {
    section = null;
  };

  const looksLikeSelfNote = (text) => {
    const cleaned = String(text || '').trim().replace(/^[-•]\s*/, '').toLowerCase();
    if (!cleaned) return false;
    return (
      /^(my|i|me)\b/.test(cleaned) ||
      /^(weakness|weaknesses|to improve)\b/.test(cleaned) ||
      /\b(my game|my performance|my weakness|my weaknesses)\b/.test(cleaned)
    );
  };

  const walkBlocks = async (blocks, playerFromToggle = null) => {
    for (const block of blocks) {
      if (block.type === 'toggle') {
        const toggleTitle = blockPlainText(block);
        if (SESSION_TOGGLE_RE.test(toggleTitle.trim())) {
          continue;
        }
        if (MY_PERFORMANCE_RE.test(toggleTitle)) {
          inOtherAnalysis = false;
          resetPlayerContext();
          continue;
        }
        if (ANALYSIS_TITLE_RE.test(toggleTitle)) {
          inOtherAnalysis = true;
          resetPlayerContext();
        }
        const playerName =
          extractPlayerFromAnalysisTitle(toggleTitle) ||
          (isLikelyPlayerName(toggleTitle) ? toggleTitle : null);
        const nested = await notionFetchAllChildren(block.id);
        await walkBlocks(nested, playerName);
        continue;
      }

      if (block.type === 'heading_3' || block.type === 'heading_2') {
        const h = blockPlainText(block);
        if (MY_PERFORMANCE_RE.test(h)) {
          inOtherAnalysis = false;
          resetPlayerContext();
          continue;
        }
        if (ANALYSIS_TITLE_RE.test(h)) {
          inOtherAnalysis = true;
          resetPlayerContext();
          continue;
        }
        if (GOOD_SECTION_RE.test(h)) {
          section = 'good';
          continue;
        }
        if (BAD_SECTION_RE.test(h)) {
          section = 'bad';
          continue;
        }
        // Prevent section bleed (e.g., "Take away" bullets inheriting "Loophole").
        section = null;
      }

      if (!CHEAT_LINE_BLOCK_TYPES.has(block.type)) continue;

      const line = blockPlainText(block);
      if (MY_PERFORMANCE_RE.test(line)) {
        inOtherAnalysis = false;
        resetPlayerContext();
        continue;
      }
      if (ANALYSIS_TITLE_RE.test(line)) {
        inOtherAnalysis = true;
        resetPlayerContext();
        continue;
      }
      if (!inOtherAnalysis) continue;

      if (GOOD_SECTION_RE.test(line)) {
        section = 'good';
        continue;
      }
      if (BAD_SECTION_RE.test(line)) {
        section = 'bad';
        continue;
      }

      if (section && !rootPlayer && isLikelyPlayerName(line) && !line.includes(':')) {
        if (block.has_children) {
          const nested = await notionFetchAllChildren(block.id);
          await walkBlocks(nested, line);
        }
        continue;
      }

      const parsed = parsePlayerLine(line, section, byPlayer);
      section = parsed.section;

      const activePlayer = playerFromToggle || rootPlayer;
      if (!parsed.consumed && activePlayer && line.trim()) {
        if (looksLikeSelfNote(line) || isUserPlanNote(line)) continue;
        const noteSection = section || (rootPlayer ? classifyObservedNote(line) : null);
        if (!noteSection) continue;
        pushNote(byPlayer, activePlayer, line, noteSection);
      }

      if (block.has_children) {
        const nested = await notionFetchAllChildren(block.id);
        await walkBlocks(nested, playerFromToggle);
      }
    }
  };

  const top = await notionFetchAllChildren(parentId);
  await walkBlocks(top, rootPlayer);
}

/** Walk entire insights page — all weekly / historical player analysis toggles. */
async function parseGameCheatNotes(pageId) {
  const byPlayer = new Map();
  const DAILY_REFLECTION_RE = /daily reflection/i;
  const SESSION_TOGGLE_RE =
    /(\d{4}-\d{2}-\d{2})|^(mon|tue|wed|thu|fri|sat|sun)(day)?\b/i;

  async function visitToggle(toggleId, title = '') {
    const toggleTitle = title || '';
    if (DAILY_REFLECTION_RE.test(toggleTitle)) return;
    if (SESSION_TOGGLE_RE.test(toggleTitle.trim())) return;
    if (MY_PERFORMANCE_RE.test(toggleTitle)) return;
    if (isPlayerAnalysisTitle(toggleTitle)) {
      await ingestPlayerAnalysisBlock(toggleId, byPlayer, toggleTitle);
    }

    const children = await notionFetchAllChildren(toggleId);
    for (const child of children) {
      if (child.type !== 'toggle') continue;
      const childTitle = blockPlainText(child);
      await visitToggle(child.id, childTitle);
    }
  }

  const blocks = await notionFetchAllChildren(pageId);
  for (const block of blocks) {
    if (block.type === 'toggle') {
      await visitToggle(block.id, blockPlainText(block));
    }
  }

  return [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function countCheatNotes(notes) {
  return (notes || []).reduce(
    (sum, row) => sum + (row.good?.length || 0) + (row.bad?.length || 0),
    0,
  );
}

function mergeCheatNotes(live, snapshot) {
  const byName = new Map();

  const mergeList = (rows) => {
    for (const row of rows || []) {
      if (!row?.name || isExcludedCheatPlayer(row.name)) continue;
      if (!byName.has(row.name)) {
        byName.set(row.name, { name: row.name, good: [], bad: [] });
      }
      const target = byName.get(row.name);
      for (const note of row.good || []) {
        if (note && !target.good.includes(note)) target.good.push(note);
      }
      for (const note of row.bad || []) {
        if (note && !target.bad.includes(note)) target.bad.push(note);
      }
    }
  };

  mergeList(snapshot);
  mergeList(live);

  return [...byName.values()]
    .filter((p) => p.good.length || p.bad.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function deriveCheatNotesFromSessions(sessions = []) {
  const byPlayer = new Map();

  const push = (name, note, section) => {
    const n = normalizePlayerName(name);
    const trimmed = String(note || '').trim();
    if (!n || !trimmed) return;
    if (!byPlayer.has(n)) byPlayer.set(n, { name: n, good: [], bad: [] });
    const row = byPlayer.get(n);
    const list = section === 'good' ? row.good : row.bad;
    if (!list.includes(trimmed)) list.push(trimmed);
  };

  const extractPlayers = (context) => {
    const c = String(context || '');
    const out = [];
    for (const m of c.matchAll(/\b(?:single game|practice|played)\s+w\/\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi)) {
      out.push(m[1].trim());
    }
    return [...new Set(out)];
  };

  for (const s of sessions) {
    const players = extractPlayers(s.context || s.label || '');
    if (!players.length) continue;
    for (const p of players) {
      for (const g of s.good || []) push(p, g, 'good');
      for (const b of s.bad || []) push(p, b, 'bad');
    }
  }

  return [...byPlayer.values()]
    .filter((p) => p.good.length || p.bad.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeCheatNoteRows(rows = []) {
  return mergeCheatNotes(
    rows.map((r) => ({
      name: normalizePlayerName(r.name || ''),
      good: r.good || [],
      bad: r.bad || [],
    })),
    [],
  );
}

function normalizeNoteKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function removeSessionTakeawayLeakage(cheatNotes = [], sessions = []) {
  const KNOWN_TAKEAWAY_PATTERNS = [
    /too many double faults on second serves/i,
    /backhand.*cross right leg/i,
    /overhead.*failed/i,
    /recovery footwork.*game points/i,
    /drop ball game.*(ball on rise|take on rise).*spiny/i,
  ];

  const sessionWeaknessKeys = new Set();
  for (const s of sessions || []) {
    for (const note of [...(s.bad || []), ...(s.learning || [])]) {
      const key = normalizeNoteKey(note);
      if (key) sessionWeaknessKeys.add(key);
    }
  }

  const shouldDrop = (note) => {
    const raw = String(note || '');
    const key = normalizeNoteKey(raw);
    if (sessionWeaknessKeys.has(key)) return true;
    return KNOWN_TAKEAWAY_PATTERNS.some((re) => re.test(raw));
  };

  return (cheatNotes || [])
    .map((row) => ({
      ...row,
      good: (row.good || []).filter((note) => !shouldDrop(note)),
      bad: (row.bad || []).filter((note) => !shouldDrop(note)),
    }))
    .filter((row) => (row.good || []).length || (row.bad || []).length);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.NOTION_TOKEN) {
    try {
      const snap = await loadSnapshot();
      return res.status(200).json({ ...snap, cheatNotesSource: 'snapshot' });
    } catch (e) {
      return res.status(503).json({ error: 'Notion token not configured and snapshot missing' });
    }
  }

  try {
    const pageId = normalizeId(PAGE_ID);
    const page = await notionFetch(`/pages/${pageId}`);
    const snap = await loadSnapshot();
    const sessions = await parseAllDailySessions(pageId);
    const sessionsForPayload = sessions.length ? sessions : snap.sessions || [];
    let cheatNotes = [];
    let cheatNotesSource = 'snapshot';
    const snapCheat = normalizeCheatNoteRows(snap.cheatNotes || []);
    try {
      const liveCheat = await parseGameCheatNotes(pageId);
      if (liveCheat.length) {
        cheatNotes = liveCheat;
        cheatNotesSource = 'notion';
      } else {
        cheatNotes = [];
        cheatNotesSource = 'notion';
      }
    } catch (cheatErr) {
      cheatNotes = snapCheat;
      cheatNotesSource = 'snapshot';
    }
    cheatNotes = removeSessionTakeawayLeakage(cheatNotes, sessionsForPayload);

    let weeklyPriorities = snap.weeklyPriorities || [];
    let weeklyOverview = snap.weeklyOverview || { focus: '', drill: '' };
    let focus = snap.focus;
    let weeklySource = 'snapshot';
    try {
      const weeklyLive = await parseWeeklyPriorities(pageId);
      if (weeklyLive?.weeklyPriorities?.length) {
        weeklyPriorities = weeklyLive.weeklyPriorities;
        weeklySource = 'notion';
        focus = undefined;
      }
      if (weeklyLive?.weeklyOverview?.focus || weeklyLive?.weeklyOverview?.drill) {
        weeklyOverview = weeklyLive.weeklyOverview;
        weeklySource = 'notion';
      }
    } catch (_) {
      /* keep snapshot weekly fields */
    }

    const payload = {
      pageUrl: page.url || snap.pageUrl,
      updatedAt: page.last_edited_time || snap.updatedAt,
      weeklyPriorities,
      weeklyOverview,
      weeklySource,
      focus,
      source: 'notion',
      sessions: sessionsForPayload,
      latestDaily: sessions[0] || snap.latestDaily,
      cheatNotes: cheatNotes.length ? cheatNotes : snapCheat,
      cheatNotesSource,
      parserVersion: 'cheat-filter-v8',
    };

    return res.status(200).json(payload);
  } catch (e) {
    try {
      const snap = await loadSnapshot();
      return res.status(200).json({
        ...snap,
        source: 'snapshot',
        cheatNotesSource: 'snapshot',
        apiError: e.message,
      });
    } catch (err) {
      return res.status(500).json({ error: e.message });
    }
  }
}
