import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { userId, botId, cleared } = await request.json();

    if (!userId || !botId) {
      return NextResponse.json({ error: 'Missing userId or botId' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { error: upsertError } = await supabase.from('trainee_progress').upsert(
      {
        user_id: userId,
        bot_id: botId,
        cleared_for_live: !!cleared,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,bot_id' }
    );
    if (upsertError) {
      console.error('Cleared for live update error:', upsertError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
