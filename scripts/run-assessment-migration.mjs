#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const filename of ['.env.local', '.env']) {
  const envPath = path.join(root, filename);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Add it to .env.local or the command environment.');
  process.exit(1);
}

const migrationPath = path.join(root, 'supabase/migrations/20260624000000_assessment_packs.sql');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query('begin');
  await client.query(fs.readFileSync(migrationPath, 'utf8'));
  await client.query('commit');

  const { rows: tables } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name = any($1::text[])
    order by table_name
  `, [['assessment_invites', 'assessment_packs', 'candidates', 'manager_reviews', 'scenarios', 'tenants']]);
  const { rows: columns } = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'sessions'
      and column_name = any($1::text[])
    order by column_name
  `, [['assessment_pack_id', 'candidate_ticket_text', 'readiness_label', 'readiness_score', 'scenario_id', 'tenant_id', 'transcript_json', 'transcript_text']]);
  const { rows: scenarioRows } = await client.query('select count(*)::int as count from scenarios where active = true');
  if (tables.length !== 6 || columns.length !== 8 || scenarioRows[0].count < 10) throw new Error('Migration verification failed: expected assessment schema objects are missing');
  console.log(`Assessment migration verified: ${tables.length} tables, ${columns.length} session columns, ${scenarioRows[0].count} active scenarios.`);
} catch (error) {
  try { await client.query('rollback'); } catch {}
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
