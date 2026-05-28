#!/usr/bin/env node
/**
 * Push NOTION_TOKEN (+ NOTION_PAGE_ID) to Vercel. Usage:
 *   NOTION_TOKEN=secret_… node scripts/setup-vercel-notion-env.mjs
 */
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.NOTION_TOKEN;
const pageId = process.env.NOTION_PAGE_ID || '32470a7de7e0803e9f3ad8904cf25efe';

if (!token?.startsWith('secret_') && !token?.startsWith('ntn_')) {
  console.error('Set NOTION_TOKEN (integration secret, e.g. secret_… or ntn_…).');
  process.exit(1);
}

function addEnv(name, value, targets) {
  for (const target of targets) {
    const r = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--force'],
      {
        cwd: root,
        input: value,
        encoding: 'utf8',
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    );
    if (r.status !== 0) {
      console.error(`Failed: vercel env add ${name} ${target}`);
      process.exit(r.status || 1);
    }
    console.log(`Set ${name} on ${target}`);
  }
}

const targets = ['production', 'preview'];
addEnv('NOTION_TOKEN', token, targets);
addEnv('NOTION_PAGE_ID', pageId, targets);
console.log('Done. Run: npx vercel deploy --prod --yes');
