#!/usr/bin/env node
/**
 * Run demo seed (realistic example data for Tom, Fernando, Jake, Nathan).
 * Requires DATABASE_URL in .env. Run after schema + seed.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.DATABASE_URL;
if (!url || url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) {
  console.error('Add DATABASE_URL to .env. See scripts/run-schema.mjs for format.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function run() {
  await client.connect();
  try {
    const seedDemo = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'seed-demo.sql'), 'utf8');
    console.log('Running demo seed...');
    await client.query(seedDemo);
    console.log('Demo seed OK.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
