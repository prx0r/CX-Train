// Preload script: loads .env.local into process.env
// Usage: node -r ./scripts/e2e-env.cjs ...
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
  console.log(`[env] Loaded ${envPath}`);
  console.log(`[env] AI_API_KEY set: ${!!process.env.AI_API_KEY}`);
  console.log(`[env] AI_EVALUATOR_MODEL: ${process.env.AI_EVALUATOR_MODEL}`);
} else {
  console.log(`[env] No .env.local at ${envPath}`);
}
