import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech, buildAzureSsml, mapMoodToAzureStyle, type CustomerMood } from '@/lib/mvp/voice/tts';

const FALLBACK_VOICE_MAP: Record<string, string> = {
  male: 'am_adam',
  female: 'af_heart',
};

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    /* Resolve voice config from: explicit params > pack snapshot > defaults */
    let azureVoiceName: string | undefined;
    let azureStyle: string | undefined;
    let azureStyleDegree: string | undefined;
    let azureRate: string | undefined;
    let azurePitch: string | undefined;

    /* Mood from request (passed from frontend based on SimState) */
    const mood: CustomerMood = body.mood || 'neutral';
    const intensity: 0 | 1 | 2 | 3 | 4 | 5 = body.intensity ?? 3;

    /* Check if Azure is configured */
    const azureKey = process.env.AZURE_TTS_KEY || process.env.AZURE_API_KEY;

    if (azureKey) {
      /* Try pack snapshot for voice name */
      try {
        const { getDb } = await import('@/lib/mvp/db');
        const db = getDb();
        const assessment = db.prepare('SELECT pack_snapshot_json FROM assessments WHERE invite_token = ?').get(params.token) as any;
        if (assessment?.pack_snapshot_json) {
          const snapshot = JSON.parse(assessment.pack_snapshot_json);
          const customer = snapshot?.customer;
          /* Use explicit azureVoice config from pack if available */
          if (customer?.azureVoice && customer.azureVoice[mood]) {
            const v = customer.azureVoice[mood];
            azureVoiceName = v.voiceName || customer.azureVoice.neutral?.voiceName;
            azureStyle = v.style;
            azureStyleDegree = String(v.styleDegree || 1.0);
            azureRate = v.rate;
            azurePitch = v.pitch;
          }
        }
      } catch { /* use defaults */ }

      /* Fallback to mood→style mapping if pack didn't provide it */
      if (!azureStyle) {
        const mapped = mapMoodToAzureStyle(mood, intensity);
        azureStyle = mapped.style;
        azureStyleDegree = mapped.styleDegree;
        azureRate = azureRate || mapped.rate;
        azurePitch = azurePitch || mapped.pitch;
      }
      if (!azureVoiceName) {
        azureVoiceName = process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural';
      }
      if (!azureRate) azureRate = '0%';
      if (!azurePitch) azurePitch = '0st';
    } else {
      /* OpenRouter fallback — use gender-based Kokoro voice */
      try {
        const { getDb } = await import('@/lib/mvp/db');
        const db = getDb();
        const assessment = db.prepare('SELECT pack_snapshot_json FROM assessments WHERE invite_token = ?').get(params.token) as any;
        if (assessment?.pack_snapshot_json) {
          const snapshot = JSON.parse(assessment.pack_snapshot_json);
          const gender = snapshot?.customer?.gender || 'female';
          process.env.VOICE_TTS_VOICE = FALLBACK_VOICE_MAP[gender] || 'af_heart';
        }
      } catch { /* use default Kokoro voice */ }
    }

    /* Override with explicit params from request body */
    if (body.azure_voice) azureVoiceName = body.azure_voice;
    if (body.azure_style) azureStyle = body.azure_style;
    if (body.azure_rate) azureRate = body.azure_rate;
    if (body.azure_pitch) azurePitch = body.azure_pitch;

    const audio = await synthesizeSpeech(text, undefined, {
      voiceName: azureVoiceName,
      style: azureStyle,
      styleDegree: azureStyleDegree ? parseFloat(azureStyleDegree) : undefined,
      rate: azureRate,
      pitch: azurePitch,
    });

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
