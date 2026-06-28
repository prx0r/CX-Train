import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { createHmac, timingSafeEqual } from 'crypto';

const DEPLOY_SECRET = process.env.DEPLOY_WEBHOOK_SECRET || '';

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !DEPLOY_SECRET) return false;
  const expected = createHmac('sha256', DEPLOY_SECRET).update(payload).digest('hex');
  const received = signature.replace(/^sha256=/, '');
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const event = request.headers.get('x-github-event') || 'push';

  /* GitHub sends ping on webhook creation to verify the endpoint */
  if (event === 'ping') {
    return NextResponse.json({ ok: true, message: 'pong' });
  }

  const body = await request.text();
  const sig = request.headers.get('x-hub-signature-256');

  if (!verifySignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const results: string[] = [];
  let success = true;

  try {
    results.push('--- git pull ---');
    const pullOut = execSync('cd /root/projects/CX-Train && git pull 2>&1', { timeout: 30000 }).toString().trim();
    results.push(pullOut);

    const changed = !pullOut.includes('Already up to date');
    if (changed) {
      results.push('');
      results.push('--- npm install ---');
      const npmOut = execSync('cd /root/projects/CX-Train && npm install 2>&1', { timeout: 60000 }).toString().trim();
      results.push(npmOut);

      results.push('');
      results.push('--- pm2 restart ---');
      const pm2Out = execSync('pm2 restart cx-train-dev 2>&1', { timeout: 10000 }).toString().trim();
      results.push(pm2Out);
    } else {
      results.push('No changes, skipping install and restart.');
    }
  } catch (err: any) {
    success = false;
    results.push('');
    results.push(`ERROR: ${err.message || err}`);
  }

  return NextResponse.json({
    success,
    output: results.join('\n'),
  });
}
