import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const formData = await request.formData();
    const sessionId = formData.get('session_id') as string;
    const botId = formData.get('bot_id') as string;
    const techName = formData.get('tech_name') as string;
    const file = formData.get('file') as File;

    if (!sessionId || !botId || !techName || !file) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, bot_id, tech_name, file' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Validate API key
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('api_key', apiKey)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const safeTechName = techName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const path = `${botId}/${safeTechName}/${sessionId}.png`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ticket-screenshots')
      .upload(path, buffer, {
        contentType: file.type || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('ticket-screenshots').getPublicUrl(path);
    const url = urlData.publicUrl;

    // Update session with screenshot URL
    await supabase.from('sessions').update({ ticket_screenshot_url: url }).eq('id', sessionId);

    return NextResponse.json({ url });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
