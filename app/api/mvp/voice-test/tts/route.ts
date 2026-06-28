import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const azureVoiceName = body.azure_voice || process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
    const azureStyle = body.azure_style || undefined;
    const azureStyleDegree = body.intensity !== undefined ? Number(body.intensity) / 5 : 1.0;

    const audio = await synthesizeSpeech(text, undefined, {
      voiceName: azureVoiceName,
      style: azureStyle,
      styleDegree: azureStyleDegree,
    });

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
