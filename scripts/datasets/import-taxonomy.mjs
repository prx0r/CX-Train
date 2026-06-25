import { readFileSync, existsSync } from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.MVP_SQLITE_PATH || './data/callcallum.db';
const XLSX_PATH = path.resolve(process.env.TAXONOMY_XLSX_PATH || 'taxonomy/Master Triage classification list.xlsx');
const JSON_PATH = path.resolve(process.env.TAXONOMY_JSON_PATH || 'taxonomy/taxonomy.json');

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex').slice(0, 12);
}

function importXlsx(db) {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets['Sheet1'];
  if (!ws) { throw new Error('No Sheet1 found'); }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const insert = db.prepare(`INSERT OR REPLACE INTO taxonomy_items
    (id, source_id, board_name, type, sub_type, item, definition_scope, playbook, keywords, helpdesk_tier, escalation_guidance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    let count = 0;
    for (const r of rows) {
      const safeId = 'tax-' + md5(String(r.ID) + r.Type + r.SubType + r.Item);
      insert.run(
        safeId,
        r.ID || null,
        r.Board_Name || 'Tier 1 Service Board',
        r.Type || '',
        r.SubType || '',
        r.Item || '',
        r['definition scope'] || '',
        r.Playbook || '',
        r.keywords || '',
        r['Helpdesk Tier'] || '',
        r['Escalation Guidance'] || ''
      );
      count++;
    }
    console.log(`Imported ${count} taxonomy items from XLSX`);
  });
  tx();
}

function importJson(db) {
  const raw = readFileSync(JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const items = data.items || [];
  const insert = db.prepare(`INSERT OR REPLACE INTO taxonomy_items
    (id, type, sub_type, item, definition_scope, playbook, keywords)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    let count = 0;
    for (const r of items) {
      const safeId = r.id || 'tax-' + md5(r.category + r.subcategory + r.title);
      insert.run(
        safeId,
        r.category || '',
        r.subcategory || '',
        r.title || '',
        r.description || '',
        (r.triage_questions || []).join('\n'),
        (r.triage_steps || []).join('\n')
      );
      count++;
    }
    console.log(`Imported ${count} taxonomy items from JSON`);
  });
  tx();
}

function main() {
  const resolvedDbPath = path.resolve(DB_PATH);
  const db = new Database(resolvedDbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`CREATE TABLE IF NOT EXISTS taxonomy_items (
    id TEXT PRIMARY KEY,
    source_id INTEGER,
    board_name TEXT NOT NULL DEFAULT 'Tier 1 Service Board',
    type TEXT NOT NULL,
    sub_type TEXT NOT NULL,
    item TEXT NOT NULL,
    definition_scope TEXT NOT NULL DEFAULT '',
    playbook TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    helpdesk_tier TEXT NOT NULL DEFAULT '',
    escalation_guidance TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const count = db.prepare('SELECT COUNT(*) as c FROM taxonomy_items').get().c;
  if (count > 0) {
    console.log(`Taxonomy table already has ${count} items. Use --force to re-import.`);
    if (!process.argv.includes('--force')) {
      db.close();
      return;
    }
    db.prepare('DELETE FROM taxonomy_items').run();
    console.log('Cleared existing taxonomy items for re-import');
  }

  if (existsSync(XLSX_PATH)) {
    importXlsx(db);
  } else if (existsSync(JSON_PATH)) {
    importJson(db);
  } else {
    console.error('No taxonomy source found. Set TAXONOMY_XLSX_PATH or TAXONOMY_JSON_PATH.');
    process.exit(1);
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM taxonomy_items').get().c;
  console.log(`Total taxonomy items in DB: ${finalCount}`);
  db.close();
}

main();
