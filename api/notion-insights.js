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
  const raw = await readFile(join(process.cwd(), 'notion-data.json'), 'utf8');
  return { ...JSON.parse(raw), source: 'snapshot' };
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
  let inDailySection = false;
  const sessions = [];

  for (const block of blocks) {
    if (block.type === 'heading_3') {
      const text = (block.heading_3?.rich_text || []).map((t) => t.plain_text).join('');
      inDailySection = /daily reflection/i.test(text);
      continue;
    }
    if (!inDailySection || block.type !== 'toggle') continue;

    const title = (block.toggle?.rich_text || []).map((t) => t.plain_text).join('');
    if (!/\d{4}-\d{2}-\d{2}/.test(title) && !/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(title)) {
      continue;
    }

    const children = await notionFetchAllChildren(block.id);
    const lines = [];
    for (const child of children) {
      if (child.type === 'bulleted_list_item' || child.type === 'numbered_list_item') {
        const line = blockPlainText(child);
        if (line.trim()) lines.push(line.trim());
      }
    }

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

const CHEAT_LINE_BLOCK_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'paragraph']);

/** Merge "Name: note" bullets from Good / Loophole under weekly player analysis. */
async function ingestPlayerAnalysisBlock(parentId, byPlayer) {
  let section = null;

  const ingestLine = (line) => {
    const trimmed = line.trim().replace(/^[-•]\s*/, '');
    if (!trimmed) return;
    if (/^good\s*:?\s*$/i.test(trimmed)) {
      section = 'good';
      return;
    }
    if (/^loophole\s*:?\s*$/i.test(trimmed) || /^bad\s*:?\s*$/i.test(trimmed)) {
      section = 'bad';
      return;
    }
    const m = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (!m || !section) return;
    const name = m[1].trim();
    const note = m[2].trim().replace(/,\s*$/, '');
    if (!name || !note) return;
    if (!byPlayer.has(name)) byPlayer.set(name, { name, good: [], bad: [] });
    const row = byPlayer.get(name);
    const list = section === 'good' ? row.good : row.bad;
    if (!list.includes(note)) list.push(note);
  };

  const walkBlocks = async (blocks) => {
    for (const block of blocks) {
      if (!CHEAT_LINE_BLOCK_TYPES.has(block.type)) continue;
      ingestLine(blockPlainText(block));
      if (block.has_children) {
        const nested = await notionFetchAllChildren(block.id);
        await walkBlocks(nested);
      }
    }
  };

  const top = await notionFetchAllChildren(parentId);
  await walkBlocks(top);
}

/** Parse weekly "Analysis on other Player's style" toggles across the insights page. */
async function parseGameCheatNotes(pageId) {
  const blocks = await notionFetchAllChildren(pageId);
  const byPlayer = new Map();

  const scanToggleChildren = async (toggleId) => {
    const children = await notionFetchAllChildren(toggleId);
    for (const child of children) {
      if (child.type === 'toggle') {
        const title = blockPlainText(child);
        if (/analysis on other player/i.test(title)) {
          await ingestPlayerAnalysisBlock(child.id, byPlayer);
          continue;
        }
        await scanToggleChildren(child.id);
      }
    }
  };

  for (const block of blocks) {
    if (block.type !== 'toggle') continue;
    const title = blockPlainText(block);
    if (/weekly insight/i.test(title)) {
      await scanToggleChildren(block.id);
    }
  }

  return [...byPlayer.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    let cheatNotes = [];
    let cheatNotesSource = 'snapshot';
    try {
      cheatNotes = await parseGameCheatNotes(pageId);
      if (cheatNotes.length) cheatNotesSource = 'notion';
    } catch (cheatErr) {
      cheatNotes = snap.cheatNotes || [];
      cheatNotesSource = 'snapshot';
    }

    const payload = {
      pageUrl: page.url || snap.pageUrl,
      updatedAt: page.last_edited_time || snap.updatedAt,
      weeklyPriorities: snap.weeklyPriorities,
      weeklyOverview: snap.weeklyOverview,
      focus: snap.focus,
      source: 'notion',
      sessions: sessions.length ? sessions : snap.sessions,
      latestDaily: sessions[0] || snap.latestDaily,
      cheatNotes: cheatNotes.length ? cheatNotes : snap.cheatNotes || [],
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
