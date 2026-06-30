import { NextRequest, NextResponse } from 'next/server';
import { createDoc, listDocs, updateDoc } from '@/lib/msp';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mspId = searchParams.get('msp_id');
  if (!mspId) return NextResponse.json({ error: 'Missing msp_id' }, { status: 400 });

  const docs = listDocs(mspId);
  return NextResponse.json({ docs });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { msp_id, title, content, taxonomy_item_id, tags } = body;
  if (!msp_id || !title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const doc = createDoc(msp_id, title, content, session.user.id, taxonomy_item_id, tags);
  return NextResponse.json({ doc });
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { id, content } = body;
  if (!id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  updateDoc(id, content);
  return NextResponse.json({ ok: true });
}
