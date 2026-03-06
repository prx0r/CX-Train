import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
const ALLOWED_EXT = ['.txt', '.md', '.csv', '.json'];

function isAllowed(filename: string, contentType: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ALLOWED_EXT.includes(ext) || ALLOWED_TYPES.includes(contentType);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: botId } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('bot_documents')
      .select('id, filename, content_type, created_at')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: botId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!isAllowed(file.name, file.type)) {
      return NextResponse.json(
        { error: 'Only .txt, .md, .csv, .json files are allowed' },
        { status: 400 }
      );
    }

    const content = await file.text();
    const supabase = createServerClient();

    const { data: bot } = await supabase.from('bots').select('id').eq('id', botId).single();
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });

    const { data: doc, error } = await supabase
      .from('bot_documents')
      .insert({
        bot_id: botId,
        filename: file.name,
        content,
        content_type: file.type || 'text/plain',
      })
      .select('id, filename, content_type, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(doc);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: botId } = await params;
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('doc_id');

    if (!docId) {
      return NextResponse.json({ error: 'Missing doc_id' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('bot_documents')
      .delete()
      .eq('id', docId)
      .eq('bot_id', botId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
