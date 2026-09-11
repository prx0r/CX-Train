// Generalized parity: candidate/manager/tech packages vs live routes.
// Every mapped route file must reference an auth helper (verifyActionsKey,
// callum-auth, better-auth) or the package FAILS with the work order.
// Run: node chatgpt/parity-check.mjs (exit 0 = green).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}${cond ? '' : ' — ' + detail}`);
  if (!cond) fail++;
};

const routeFile = (p) => join(root, 'app/api', ...p.split('/'), 'route.ts');
const PACKS = {
  candidate: {
    yaml: 'chatgpt/actions-openapi.yaml',
    ops: {
      validateAssessment: 'mvp/assessment/[token]',
      sendMessage: 'mvp/assessment/[token]/message',
      submitTicket: 'mvp/assessment/[token]/ticket',
      getReport: 'mvp/assessments/[id]',
    },
  },
  manager: {
    yaml: 'chatgpt/manager/actions-openapi.yaml',
    ops: {
      createAssessment: 'mvp/assessments',
      reviewAssessment: 'mvp/assessments/[id]',
      saveFeedback: 'mvp/assessments/[id]/feedback',
      getStandards: 'mvp/standards',
      updateStandards: 'mvp/standards',
      confirmProposal: 'mvp/callum/proposals/[id]/confirm',
      rejectProposal: 'mvp/callum/proposals/[id]/reject',
    },
  },
  tech: {
    yaml: 'chatgpt/tech/actions-openapi.yaml',
    ops: {
      triageTicket: 'msp/triage',
      searchTaxonomy: 'mvp/taxonomy/search',
      generateScenario: 'taxonomy/scenario',
    },
  },
};

// NOTE: matches getSessionByAssessment-style helpers do NOT count — only
// real auth (bearer key verification or user-session enforcement).
const AUTH_RES = [/verifyActionsKey/, /callum-auth/, /better-auth\/[^/]/,
  /getServerSession/, /auth\(\)\.then/, /headers\.get\(['"]authorization['"]\)/];
for (const [pkg, spec] of Object.entries(PACKS)) {
  const yaml = readFileSync(join(root, spec.yaml), 'utf8');
  for (const [op, route] of Object.entries(spec.ops)) {
    check(`${pkg}/${op} declared`, yaml.includes(`operationId: ${op}`));
    const file = routeFile(route);
    check(`${pkg}/${op} route exists`, existsSync(file), route);
    if (existsSync(file)) {
      const src = readFileSync(file, 'utf8');
      check(`${pkg}/${op} auth wired`,
        AUTH_RES.some((re) => re.test(src)), `${route} has no auth helper`);
    }
  }
}
const unguarded = [];
for (const [pkg, spec] of Object.entries(PACKS)) {
  for (const [op, route] of Object.entries(spec.ops)) {
    const file = routeFile(route);
    if (existsSync(file) && !AUTH_RES.some((re) => re.test(readFileSync(file, 'utf8')))) {
      unguarded.push(`${pkg}/${op} -> ${route}`);
    }
  }
}
if (unguarded.length) {
  console.log(`\nBACKEND WORK ORDER (${unguarded.length} routes need verifyActionsKey):`);
  for (const u of unguarded) console.log(`  - ${u}`);
}
console.log(fail === 0 ? 'PARITY GREEN' : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
