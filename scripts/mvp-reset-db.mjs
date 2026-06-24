#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config();

import fs from 'fs';
import path from 'path';

const dbPath = process.env.MVP_SQLITE_PATH || './data/callcallum.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);

console.log(`[mvp:reset-db] Deleting SQLite database at: ${resolvedPath}`);

if (fs.existsSync(resolvedPath)) {
  // Also delete WAL and SHM files
  try { fs.unlinkSync(resolvedPath + '-wal'); } catch {}
  try { fs.unlinkSync(resolvedPath + '-shm'); } catch {}
  fs.unlinkSync(resolvedPath);
  console.log('[mvp:reset-db] Deleted.');
} else {
  console.log('[mvp:reset-db] No database file found.');
}

// Re-initialise
console.log('[mvp:reset-db] Re-initialising...');
import('./mvp-init-db.mjs').then(() => {
  console.log('[mvp:reset-db] Done.');
});
