import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const supabase = createServerClient();
    const { data: bot } = await supabase.from('bots').select('*').eq('id', id).single();
    if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });

    const promptVersionHistory = (bot.prompt_version_history as unknown[]) || [];
    if (body.system_prompt !== undefined) {
      promptVersionHistory.push({
        prompt: bot.system_prompt,
        saved_at: new Date().toISOString(),
      });
      const toKeep = promptVersionHistory.slice(-5);
      await supabase
        .from('bots')
        .update({
          system_prompt: body.system_prompt,
          prompt_version_history: toKeep,
        })
        .eq('id', id);
    }

    const { data: updated } = await supabase.from('bots').select('*').eq('id', id).single();
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
