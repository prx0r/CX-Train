import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const voice = body.voice || undefined;
    const audio = await synthesizeSpeech(text, voice);

    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': String(audio.byteLength),
      },
    });
  } catch (err: any) {
    console.error('[Voice] TTS error:', err.message);

    if (err.message?.includes('too long')) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }

    return NextResponse.json(
      { error: 'TTS failed', detail: err.message },
      { status: 502 },
    );
  }
}
