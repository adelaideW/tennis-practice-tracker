/**
 * Vercel serverless: live Notion fetch when NOTION_TOKEN is set on the project.
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

async function loadSnapshot() {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const raw = await readFile(join(process.cwd(), 'notion-data.json'), 'utf8');
  return { ...JSON.parse(raw), source: 'snapshot' };
}

/** Walk toggle blocks; return first daily reflection with a mention-date in the title. */
async function parseLatestDaily(pageId) {
  const blocks = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
  let inDailySection = false;

  for (const block of blocks.results || []) {
    if (block.type === 'heading_3') {
      const text = (block.heading_3?.rich_text || []).map((t) => t.plain_text).join('');
      inDailySection = /daily reflection/i.test(text);
      continue;
    }
    if (!inDailySection || block.type !== 'toggle') continue;

    const title = (block.toggle?.rich_text || []).map((t) => t.plain_text).join('');
    if (!/\d{4}-\d{2}-\d{2}/.test(title) && !/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(title)) continue;

    const children = await notionFetch(`/blocks/${block.id}/children?page_size=50`);
    const lines = [];
    for (const child of children.results || []) {
      if (child.type === 'bulleted_list_item') {
        const line = (child.bulleted_list_item?.rich_text || [])
          .map((t) => t.plain_text)
          .join('');
        if (line.trim()) lines.push(line.trim());
      }
    }

    const good = [];
    const bad = [];
    let section = null;
    let context = '';

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('context:')) {
        context = line.replace(/^context:\s*/i, '');
        continue;
      }
      if (lower === 'good:' || lower.startsWith('good')) {
        section = 'good';
        continue;
      }
      if (lower === 'bad:' || lower.startsWith('bad') || lower.startsWith('learning')) {
        section = 'bad';
        continue;
      }
      const bullet = line.replace(/^[-•]\s*/, '');
      if (!bullet) continue;
      if (section === 'good') good.push(bullet);
      else if (section === 'bad') bad.push(bullet);
      else if (!context) context = bullet;
    }

    const dateMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
    const notesDraft = [
      `Context: ${context || title}`,
      '',
      good.length ? `Good:\n${good.map((g) => `- ${g}`).join('\n')}` : '',
      bad.length ? `\nNeeds work:\n${bad.map((b) => `- ${b}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      latestDaily: {
        date: dateMatch ? dateMatch[1] : title,
        label: title,
        context: context || title,
        good,
        bad,
        learning: [],
      },
      notesDraft,
    };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.NOTION_TOKEN) {
    try {
      const snap = await loadSnapshot();
      return res.status(200).json(snap);
    } catch (e) {
      return res.status(503).json({ error: 'Notion token not configured and snapshot missing' });
    }
  }

  try {
    const pageId = normalizeId(PAGE_ID);
    const page = await notionFetch(`/pages/${pageId}`);
    const parsed = await parseLatestDaily(pageId);
    const snap = await loadSnapshot();

    const payload = {
      pageUrl: page.url || snap.pageUrl,
      updatedAt: page.last_edited_time || snap.updatedAt,
      weeklyPriorities: snap.weeklyPriorities,
      source: 'notion',
      ...(parsed || {
        latestDaily: snap.latestDaily,
        notesDraft: snap.notesDraft,
      }),
    };

    if (parsed?.notesDraft && snap.weeklyPriorities?.length) {
      payload.notesDraft = `${parsed.notesDraft}\n\nWeekly focus (from Notion):\n${snap.weeklyPriorities.map((p) => `- ${p}`).join('\n')}`;
    }

    return res.status(200).json(payload);
  } catch (e) {
    try {
      const snap = await loadSnapshot();
      return res.status(200).json({ ...snap, source: 'snapshot', apiError: e.message });
    } catch (err) {
      return res.status(500).json({ error: e.message });
    }
  }
}
