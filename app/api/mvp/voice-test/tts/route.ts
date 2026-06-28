import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech, resolveAzureStyle, mapMoodToAzureStyle } from '@/lib/mvp/voice/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const azureVoiceName = body.azure_voice || process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
    const emotion = body.azure_style || 'chat';
    const intensity: 0 | 1 | 2 | 3 | 4 | 5 = body.intensity ?? 3;

    /* Use the same mood→style mapping as the assessment TTS route */
    const moodConfig = mapMoodToAzureStyle(emotion as any, intensity);
    const resolvedStyle = resolveAzureStyle(moodConfig.style, azureVoiceName);

    const audio = await synthesizeSpeech(text, undefined, {
      voiceName: azureVoiceName,
      style: resolvedStyle,
      styleDegree: parseFloat(moodConfig.styleDegree),
      rate: moodConfig.rate,
      pitch: moodConfig.pitch,
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
