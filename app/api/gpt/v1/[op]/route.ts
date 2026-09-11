import { NextRequest, NextResponse } from 'next/server';
import { verifyActionsKey } from '@/lib/callum-auth';
import * as V1 from '@/lib/gpt/v1';

type R = { status: number; body: any };
const out = (r: R) => NextResponse.json(r.body, { status: r.status });
const denied = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const need = (v: any, name: string) =>
  v ? null : NextResponse.json({ error: `Missing ${name}` }, { status: 400 });

/* GET ops read query params. POST ops read JSON bodies. */
export async function GET(request: NextRequest, { params }: { params: { op: string } }) {
  if (!verifyActionsKey(request).valid) return denied();
  const q = request.nextUrl.searchParams;
  try {
    switch (params.op) {
      case 'review':
        return out(V1.managerReport(q.get('id') || ''));
      case 'candidate-report':
        return out(V1.candidateReport(q.get('id') || ''));
      case 'standards':
        return out(V1.readStandards());
      case 'taxonomy-search':
        return out(V1.searchTaxonomy(q.get('q') || '', parseInt(q.get('limit') || '50', 10)));
      default:
        return NextResponse.json({ error: `Unknown op: ${params.op}` }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'GPT v1 failed', detail: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { op: string } }) {
  if (!verifyActionsKey(request).valid) return denied();
  const body = await request.json().catch(() => ({}));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
  try {
    switch (params.op) {
      case 'create':
        return out(V1.createAssessment(body, baseUrl));
      case 'feedback': {
        const bad = need(body.id, 'id');
        if (bad) return bad;
        return out(V1.saveFeedback(body.id, body));
      }
      case 'standards':
        return out(V1.writeStandards(body));
      case 'confirm': {
        const bad = need(body.id, 'id');
        if (bad) return bad;
        return out(V1.confirmProposal(body.id, body, baseUrl));
      }
      case 'reject': {
        const bad = need(body.id, 'id');
        if (bad) return bad;
        return out(V1.rejectProposal(body.id, body));
      }
      case 'triage':
        return out(await V1.triage(body.description));
      case 'scenario':
        return out(await V1.generateScenario(body.item_id));
      default:
        return NextResponse.json({ error: `Unknown op: ${params.op}` }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'GPT v1 failed', detail: String(err) }, { status: 500 });
  }
}
