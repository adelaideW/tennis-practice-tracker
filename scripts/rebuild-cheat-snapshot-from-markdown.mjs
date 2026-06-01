#!/usr/bin/env node
/**
 * Rebuild cheatNotes in notion-data.json from a Notion MCP export (markdown in JSON).
 * Usage: node scripts/rebuild-cheat-snapshot-from-markdown.mjs path/to/notion-fetch.json
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exportPath = process.argv[2];

if (!exportPath) {
  console.error('Usage: node scripts/rebuild-cheat-snapshot-from-markdown.mjs <notion-fetch.json>');
  process.exit(1);
}

const GOOD_SECTION_RE = /^(good(\s+at)?|strengths)\s*:?\s*$/i;
const BAD_SECTION_RE = /^(loophole|bad|weakness(es)?|needs?\s*work|exploit)\s*:?\s*$/i;
const ANALYSIS_TITLE_RE = /analysis on other/i;
const PLAYER_STYLE_ANALYSIS_RE = /analysis on\s+(.+?)['’]?\s+s?\s+play style/i;
const MY_PERFORMANCE_RE =
  /\b(?:analysis\s+(?:on|of)\s+my(?:\s+performance|\s+game)?|my\s+(?:performance|game|weakness(?:es)?|notes)|personal\s+weakness(?:es)?|myself)\b/i;
const PLAYER_ALIASES = { Jessy: 'Jessie', Jessie: 'Jessie', coach: 'Coach' };

function normalizePlayerName(name) {
  return PLAYER_ALIASES[name.trim()] || name.trim();
}

function extractPlayerFromAnalysisTitle(text) {
  const title = String(text || '').trim();
  const m = title.match(PLAYER_STYLE_ANALYSIS_RE);
  if (!m?.[1]) return null;
  return m[1].trim().replace(/^other\s+/i, '').replace(/\s+/g, ' ');
}

function classifyObservedNote(note) {
  const lower = note.trim().toLowerCase();
  if (/^(good|strong|great|excellent|very good)\b/.test(lower)) return 'good';
  const badSignals =
    /\b(weak|not |lack |doesn'?t|errors?|unstable|slow|miss|struggle|late|prone|hesitate|tend to miss|into the net|mostly out|hard time|not enough|not very|not as|not consistent)\b/;
  return badSignals.test(lower) ? 'bad' : 'good';
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

function parseMarkdownCheatNotes(text) {
  const byPlayer = new Map();
  let inOtherAnalysis = false;
  let section = null;
  let currentPlayer = null;
  let titlePlayer = null;

  const looksLikeSelfNote = (note) => {
    const cleaned = String(note || '').trim().replace(/^[-•]\s*/, '').toLowerCase();
    if (!cleaned) return false;
    return (
      /^(my|i|me)\b/.test(cleaned) ||
      /^(weakness|weaknesses|to improve)\b/.test(cleaned) ||
      /\b(my game|my performance|my weakness|my weaknesses)\b/.test(cleaned)
    );
  };

  const push = (name, note, sec) => {
    const n = normalizePlayerName(name);
    const noteT = note.trim().replace(/,\s*$/, '');
    if (!n || !noteT || /^(good|loophole)$/i.test(n)) return;
    if (!byPlayer.has(n)) byPlayer.set(n, { name: n, good: [], bad: [] });
    const row = byPlayer.get(n);
    const list = sec === 'good' ? row.good : row.bad;
    if (!list.includes(noteT)) list.push(noteT);
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ').trim();
    const bullet = line.replace(/^[-•]\s*/, '').trim();
    if (!bullet) continue;

    if (MY_PERFORMANCE_RE.test(bullet)) {
      inOtherAnalysis = false;
      section = null;
      currentPlayer = null;
      continue;
    }
    if (ANALYSIS_TITLE_RE.test(bullet)) {
      inOtherAnalysis = true;
      section = null;
      currentPlayer = null;
      titlePlayer = null;
      continue;
    }
    const playerFromTitle = extractPlayerFromAnalysisTitle(bullet);
    if (playerFromTitle) {
      inOtherAnalysis = true;
      section = null;
      currentPlayer = null;
      titlePlayer = playerFromTitle;
      continue;
    }
    if (!inOtherAnalysis) continue;

    if (GOOD_SECTION_RE.test(bullet)) {
      section = 'good';
      currentPlayer = null;
      continue;
    }
    if (BAD_SECTION_RE.test(bullet)) {
      section = 'bad';
      currentPlayer = null;
      continue;
    }

    const colon = bullet.match(/^([^:]{1,40}):\s*(.+)$/);
    if (colon && section) {
      push(colon[1], colon[2], section);
      continue;
    }

    if (isLikelyPlayerName(bullet) && !bullet.includes(':')) {
      currentPlayer = bullet;
      continue;
    }

    const activePlayer = currentPlayer || titlePlayer;
    // Keep only explicit Good/Loophole entries under a known player section.
    if (activePlayer && section && !looksLikeSelfNote(bullet)) {
      push(activePlayer, bullet, section);
    }
  }

  return [...byPlayer.values()]
    .filter((p) => p.good.length || p.bad.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

const raw = JSON.parse(await readFile(exportPath, 'utf8'));
const text = raw.text || raw.content || '';
const cheatNotes = parseMarkdownCheatNotes(text);
const existing = JSON.parse(await readFile(join(root, 'notion-data.json'), 'utf8'));

const out = {
  ...existing,
  updatedAt: new Date().toISOString(),
  cheatNotes,
  cheatNotesSource: 'markdown-export',
};

await writeFile(join(root, 'notion-data.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
await copyFile(join(root, 'notion-data.json'), join(root, 'api', 'notion-data.json'));

const count = cheatNotes.reduce((s, p) => s + p.good.length + p.bad.length, 0);
console.log(`Wrote ${cheatNotes.length} players, ${count} notes: ${cheatNotes.map((p) => p.name).join(', ')}`);
