import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export function getDb() {
  const dbPath = process.env.MVP_SQLITE_PATH || './data/callcallum.db';
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function makeId() {
  return 'mvp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
