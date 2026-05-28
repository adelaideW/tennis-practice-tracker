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
const MY_PERFORMANCE_RE = /analysis on my(\s+performance)?/i;

const PLAYER_ALIASES = {
  Jessy: 'Jessie',
  Jessie: 'Jessie',
  coach: 'Coach',
};

function normalizePlayerName(name) {
  const t = name.trim();
  return PLAYER_ALIASES[t] || t;
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
  if (!trimmedName || !trimmedNote) return;
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
  if (!t || t.length > 24) return false;
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

/** Ingest Good / Loophole notes from any analysis block subtree. */
async function ingestPlayerAnalysisBlock(parentId, byPlayer) {
  let section = null;
  let currentPlayer = null;
  let inOtherAnalysis = true;

  const walkBlocks = async (blocks, playerFromToggle = null) => {
    for (const block of blocks) {
      if (block.type === 'toggle') {
        const toggleTitle = blockPlainText(block);
        if (MY_PERFORMANCE_RE.test(toggleTitle)) {
          inOtherAnalysis = false;
          continue;
        }
        if (ANALYSIS_TITLE_RE.test(toggleTitle)) {
          inOtherAnalysis = true;
          section = null;
          currentPlayer = null;
        }
        const playerName = isLikelyPlayerName(toggleTitle) ? toggleTitle : playerFromToggle;
        const nested = await notionFetchAllChildren(block.id);
        await walkBlocks(nested, playerName);
        continue;
      }

      if (block.type === 'heading_3' || block.type === 'heading_2') {
        const h = blockPlainText(block);
        if (MY_PERFORMANCE_RE.test(h)) {
          inOtherAnalysis = false;
          continue;
        }
        if (ANALYSIS_TITLE_RE.test(h)) {
          inOtherAnalysis = true;
          section = null;
          currentPlayer = null;
          continue;
        }
        if (GOOD_SECTION_RE.test(h)) {
          section = 'good';
          currentPlayer = null;
          continue;
        }
        if (BAD_SECTION_RE.test(h)) {
          section = 'bad';
          currentPlayer = null;
          continue;
        }
        if (inOtherAnalysis && isLikelyPlayerName(h)) {
          currentPlayer = h;
          continue;
        }
      }

      if (!CHEAT_LINE_BLOCK_TYPES.has(block.type)) continue;

      const line = blockPlainText(block);
      if (MY_PERFORMANCE_RE.test(line)) {
        inOtherAnalysis = false;
        continue;
      }
      if (ANALYSIS_TITLE_RE.test(line)) {
        inOtherAnalysis = true;
        section = null;
        currentPlayer = null;
        continue;
      }
      if (!inOtherAnalysis) continue;

      if (GOOD_SECTION_RE.test(line)) {
        section = 'good';
        currentPlayer = null;
        continue;
      }
      if (BAD_SECTION_RE.test(line)) {
        section = 'bad';
        currentPlayer = null;
        continue;
      }

      if (isLikelyPlayerName(line) && !line.includes(':')) {
        currentPlayer = line;
        if (block.has_children) {
          const nested = await notionFetchAllChildren(block.id);
          await walkBlocks(nested, currentPlayer);
        }
        continue;
      }

      const parsed = parsePlayerLine(line, section, byPlayer);
      section = parsed.section;

      const activePlayer = currentPlayer || playerFromToggle;
      if (!parsed.consumed && activePlayer && line.trim()) {
        const noteSection = section || classifyObservedNote(line);
        pushNote(byPlayer, activePlayer, line, noteSection);
      }

      if (block.has_children) {
        const nested = await notionFetchAllChildren(block.id);
        await walkBlocks(nested, currentPlayer || playerFromToggle);
      }
    }
  };

  const top = await notionFetchAllChildren(parentId);
  await walkBlocks(top);
}

async function subtreeHasCheatSections(blockId) {
  const children = await notionFetchAllChildren(blockId);
  for (const block of children) {
    const text = blockPlainText(block);
    if (ANALYSIS_TITLE_RE.test(text)) return true;
    if (GOOD_SECTION_RE.test(text) || BAD_SECTION_RE.test(text)) return true;
    if (block.has_children && (await subtreeHasCheatSections(block.id))) return true;
  }
  return false;
}

/** Walk entire insights page — all weekly / historical player analysis toggles. */
async function parseGameCheatNotes(pageId) {
  const byPlayer = new Map();

  async function visitToggle(toggleId, title = '') {
    const toggleTitle = title || '';
    if (ANALYSIS_TITLE_RE.test(toggleTitle) || (await subtreeHasCheatSections(toggleId))) {
      await ingestPlayerAnalysisBlock(toggleId, byPlayer);
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
      if (!row?.name) continue;
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
    const sessionCheat = deriveCheatNotesFromSessions(sessionsForPayload);
    try {
      const liveCheat = mergeCheatNotes(
        await parseGameCheatNotes(pageId),
        sessionCheat,
      );
      if (liveCheat.length) {
        cheatNotes = liveCheat;
        cheatNotesSource = 'notion';
        if (countCheatNotes(liveCheat) < countCheatNotes(snapCheat)) {
          cheatNotes = mergeCheatNotes(liveCheat, snapCheat);
          cheatNotesSource = 'notion+snapshot';
        }
      } else {
        cheatNotes = mergeCheatNotes(sessionCheat, snapCheat);
        cheatNotesSource = cheatNotes.length ? 'notion+snapshot' : 'notion';
      }
    } catch (cheatErr) {
      cheatNotes = snapCheat;
      cheatNotesSource = 'snapshot';
    }

    // Always enrich cheat notes with player-specific daily-session context.
    cheatNotes = mergeCheatNotes(cheatNotes, sessionCheat);
    if (cheatNotesSource === 'snapshot' && sessionCheat.length) {
      cheatNotesSource = 'notion+snapshot';
    }

    const payload = {
      pageUrl: page.url || snap.pageUrl,
      updatedAt: page.last_edited_time || snap.updatedAt,
      weeklyPriorities: snap.weeklyPriorities,
      weeklyOverview: snap.weeklyOverview,
      focus: snap.focus,
      source: 'notion',
      sessions: sessionsForPayload,
      latestDaily: sessions[0] || snap.latestDaily,
      cheatNotes: cheatNotes.length ? cheatNotes : snapCheat,
      cheatNotesSource,
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
