import { NextRequest, NextResponse } from 'next/server';
import { triageTicket } from '@/lib/msp';

/* Classify a ticket description against the taxonomy */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { description } = body;
  if (!description) return NextResponse.json({ error: 'Missing description' }, { status: 400 });

  const result = await triageTicket(description);
  return NextResponse.json(result);
}
