#!/usr/bin/env node
/** Keep api/notion-data.json in sync for Vercel serverless bundles. */
import { copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await copyFile(join(root, 'notion-data.json'), join(root, 'api', 'notion-data.json'));
console.log('Copied notion-data.json → api/notion-data.json');
