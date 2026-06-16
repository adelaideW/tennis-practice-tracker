#!/usr/bin/env node
/**
 * Refresh notion-data.json from live Notion (requires NOTION_TOKEN).
 * Usage: NOTION_TOKEN=secret_… node scripts/sync-notion-snapshot.mjs
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PAGE_ID = process.env.NOTION_PAGE_ID || '32470a7de7e0803e9f3ad8904cf25efe';
const NOTION_VERSION = '2022-06-28';

if (!process.env.NOTION_TOKEN) {
  console.error('Set NOTION_TOKEN to sync from Notion.');
  process.exit(1);
}

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
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const pageId = normalizeId(PAGE_ID);
  const page = await notionFetch(`/pages/${pageId}`);
  const candidates = [
    process.env.SYNC_API_URL,
    'http://127.0.0.1:3000/api/notion-insights',
    'https://tennis-practice-tracker.vercel.app/api/notion-insights',
  ].filter(Boolean);

  let payload;
  for (const apiUrl of candidates) {
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (res.ok) {
        payload = await res.json();
        if (payload?.cheatNotes?.length || payload?.sessions?.length || payload?.weeklyPriorities?.length) {
          console.log(`Fetched Notion payload from ${apiUrl}`);
          break;
        }
      }
    } catch (_) {
      /* try next */
    }
  }

  if (!payload?.cheatNotes?.length && !payload?.sessions?.length && !payload?.weeklyPriorities?.length) {
    console.error('Empty Notion payload. Deploy API or run `npx vercel dev` and set SYNC_API_URL.');
    process.exit(1);
  }

  const existing = JSON.parse(await readFile(join(root, 'notion-data.json'), 'utf8'));
  const out = {
    ...existing,
    pageUrl: page.url || existing.pageUrl,
    updatedAt: page.last_edited_time || new Date().toISOString(),
    cheatNotes: payload.cheatNotes || existing.cheatNotes,
    cheatNotesSource: payload.cheatNotesSource || existing.cheatNotesSource || 'notion',
    source: 'snapshot',
  };

  if (payload.sessions?.length) {
    out.sessions = payload.sessions;
    out.latestDaily = payload.latestDaily || payload.sessions[0];
  }
  if (payload.weeklyPriorities?.length) {
    out.weeklyPriorities = payload.weeklyPriorities;
    out.weeklyOverview = payload.weeklyOverview || existing.weeklyOverview;
    out.weeklySource = payload.weeklySource || 'notion';
    delete out.focus;
  }
  if (payload.previousWeekFocus) {
    out.previousWeekFocus = payload.previousWeekFocus;
  }

  await writeFile(join(root, 'notion-data.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  await copyFile(join(root, 'notion-data.json'), join(root, 'api', 'notion-data.json'));
  const cheatCount = (out.cheatNotes || []).reduce(
    (s, p) => s + (p.good?.length || 0) + (p.bad?.length || 0),
    0,
  );
  console.log(
    `Wrote notion-data.json — ${out.sessions?.length || 0} sessions, ` +
      `${out.weeklyPriorities?.length || 0} weekly priorities, ` +
      `${(out.cheatNotes || []).length} cheat players (${cheatCount} notes).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
