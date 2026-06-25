import fs from 'fs';
import path from 'path';

interface DatasetProfile {
  source: string;
  status: 'available' | 'not_downloaded' | 'licence_pending';
  files: FileProfile[];
  generated_at: string;
  notes: string[];
}

interface FileProfile {
  filename: string;
  expected_type: string;
  status: 'found' | 'not_found' | 'not_downloaded';
  estimated_row_count?: number;
  columns?: ColumnProfile[];
  missingness_summary?: string;
  sample_rows?: Record<string, unknown>[];
  distributions?: Record<string, Record<string, number>>;
}

interface ColumnProfile {
  name: string;
  dtype: string;
  null_count: number;
  unique_values?: number;
  sample_values: string[];
}

const MENDELAY_PATH = process.env.MENDELAY_DATASET_PATH || '';

function profileMendeley(): DatasetProfile {
  const files: FileProfile[] = [
    { filename: 'issues.csv', expected_type: 'CSV', status: 'not_downloaded' },
    { filename: 'issues_change_history.csv', expected_type: 'CSV', status: 'not_downloaded' },
    { filename: 'issues_snapshots.csv', expected_type: 'CSV', status: 'not_downloaded' },
    { filename: 'scored_issues_snapshot_sample.xlsx', expected_type: 'XLSX', status: 'not_downloaded' },
    { filename: 'sample_utterances.csv', expected_type: 'CSV', status: 'not_downloaded' },
    { filename: 'FEATURES.md', expected_type: 'Markdown', status: 'not_downloaded' },
    { filename: 'EXAMPLE.md', expected_type: 'Markdown', status: 'not_downloaded' },
    { filename: 'process-flow.png', expected_type: 'PNG', status: 'not_downloaded' },
  ];

  if (MENDELAY_PATH && fs.existsSync(MENDELAY_PATH)) {
    const entries = fs.readdirSync(MENDELAY_PATH);
    for (const file of files) {
      if (entries.includes(file.filename)) {
        file.status = 'found';
      }
    }
  }

  return {
    source: 'mendeley_helpdesk_tickets_v2',
    status: MENDELAY_PATH && fs.existsSync(MENDELAY_PATH) ? 'available' : 'not_downloaded',
    files,
    generated_at: new Date().toISOString(),
    notes: [
      'Download from https://data.mendeley.com/datasets/btm76zndnt/2',
      'Licence: CC BY 4.0 — commercial use permitted with attribution',
      'Fields reported_by and assigned_to are anonymised/masked',
      'scores in scored_issues_snapshot_sample.xlsx use 1-5 scale across 3 unnamed targets',
      'Dataset published 30 May 2025, covers tickets Jan 2016 - Mar 2023',
    ],
  };
}

function profileKaggle(): DatasetProfile {
  return {
    source: 'kaggle_it_helpdesk_chatbot',
    status: 'licence_pending',
    files: [
      {
        filename: 'unknown (dataset not yet inspected)',
        expected_type: 'CSV/JSON',
        status: 'not_downloaded',
      },
    ],
    generated_at: new Date().toISOString(),
    notes: [
      'Source: https://www.kaggle.com/datasets/bitsofishan/it-helpdesk-chatbot-dataset',
      'Licence: UNVERIFIED — do not use until confirmed',
      'Requires Kaggle account to download',
      'Likely contains IT helpdesk Q&A pairs for chatbot training',
    ],
  };
}

function writeProfile(profile: unknown, filepath: string): void {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(profile, null, 2), 'utf-8');
}

function writeSummary(profiles: DatasetProfile[], filepath: string): void {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });

  const lines: string[] = [
    '# Dataset Profile Summary — CallCallum',
    '',
    'Generated: ' + new Date().toISOString(),
    '',
    '---',
    '',
  ];

  for (const profile of profiles) {
    lines.push(`## ${profile.source}`);
    lines.push('');
    lines.push(`Status: **${profile.status}**`);
    lines.push('');
    lines.push('### Files');
    lines.push('');
    lines.push('| File | Type | Status |');
    lines.push('|------|------|--------|');
    for (const file of profile.files) {
      lines.push(`| ${file.filename} | ${file.expected_type} | ${file.status} |`);
    }
    lines.push('');
    lines.push('### Notes');
    for (const note of profile.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## Usage');
  lines.push('');
  lines.push('- Run `npm run datasets:profile` to regenerate this profile after downloading datasets');
  lines.push('- Set `MENDELAY_DATASET_PATH` env var to point to downloaded Mendeley files');
  lines.push('- Only lightweight derived data is committed — never raw CSVs');
  lines.push('');

  fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
}

function main(): void {
  const mendeley = profileMendeley();
  const kaggle = profileKaggle();

  const profiles = [mendeley, kaggle];

  writeProfile(mendeley, 'data/derived/mendeley-profile.json');
  writeProfile(kaggle, 'data/derived/kaggle-profile.json');

  const combined = {
    profiles,
    generated_at: new Date().toISOString(),
    total_datasets: profiles.length,
    available: profiles.filter(p => p.status === 'available').length,
    pending: profiles.filter(p => p.status !== 'available').length,
  };

  writeProfile(combined, 'data/derived/dataset-profile.json');
  writeSummary(profiles, 'docs/DATASET_PROFILE_SUMMARY.md');

  console.log('Profiles written to data/derived/');
  console.log(`  Mendeley: ${mendeley.status}`);
  console.log(`  Kaggle:   ${kaggle.status}`);
  console.log('Summary written to docs/DATASET_PROFILE_SUMMARY.md');
}

main();
