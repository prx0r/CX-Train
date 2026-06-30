import { NextRequest, NextResponse } from 'next/server';
import { getMSPStandards, upsertMSPStandards } from '@/lib/msp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mspId = searchParams.get('msp_id');
  if (!mspId) return NextResponse.json({ error: 'Missing msp_id' }, { status: 400 });
  const standards = getMSPStandards(mspId);
  return NextResponse.json({ standards });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { msp_id, ...data } = body;
  if (!msp_id) return NextResponse.json({ error: 'Missing msp_id' }, { status: 400 });
  upsertMSPStandards(msp_id, data);
  return NextResponse.json({ ok: true });
}
