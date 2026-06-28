import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';

const KOKORO_VOICES: Record<string, string> = {
  'af_heart': 'Heart (US Female, warm)',
  'af_bella': 'Bella (US Female)',
  'af_nicole': 'Nicole (US Female)',
  'af_aoede': 'Aoede (US Female)',
  'af_kore': 'Kore (US Female)',
  'am_adam': 'Adam (US Male)',
  'am_michael': 'Michael (US Male)',
  'am_liam': 'Liam (US Male)',
  'am_onyx': 'Onyx (US Male)',
  'bf_emma': 'Emma (British Female)',
  'bf_isabella': 'Isabella (British Female)',
  'bm_george': 'George (British Male)',
  'bm_lewis': 'Lewis (British Male)',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    const voice = body.voice || 'af_heart';

    const audio = await synthesizeSpeech(text, voice);

    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Content-Length': String(audio.byteLength),
      },
    });
  } catch (err: any) {
    console.error('[Voice Test] TTS error:', err.message);
    return NextResponse.json({ error: 'TTS failed', detail: err.message }, { status: 500 });
  }
}
