import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { bot_id } = await params;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: bot, error } = await supabase
      .from('bots')
      .select('id, system_prompt')
      .eq('id', bot_id)
      .eq('api_key', apiKey)
      .single();

    if (error || !bot) {
      return NextResponse.json({ error: 'Invalid API key or bot not found' }, { status: 401 });
    }

    return NextResponse.json({
      system_prompt: bot.system_prompt || '',
    });
  } catch (err) {
    console.error('Prompt API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
