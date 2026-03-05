#!/usr/bin/env node
/**
 * Run Supabase schema + seed.
 * Add to .env: DATABASE_URL=postgresql://postgres:[PASSWORD]@db.kdiddjffblwvrukeaytm.supabase.co:5432/postgres
 * Get password from: Supabase Dashboard → Project Settings → Database
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.DATABASE_URL;
if (!url || url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) {
  console.error(`
Add DATABASE_URL to .env:
  DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.kdiddjffblwvrukeaytm.supabase.co:5432/postgres

Get the password from: Supabase Dashboard → Project Settings → Database → Database password

Then run: node scripts/run-schema.mjs
`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function run() {
  await client.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'seed.sql'), 'utf8');

    console.log('Running schema...');
    await client.query(schema);
    console.log('Schema OK');

    console.log('Running seed...');
    await client.query(seed);
    console.log('Seed OK');

    console.log('Done.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
