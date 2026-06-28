import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';
import { getDb } from '@/lib/mvp/db';

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

    /* Derive Azure voice config from pack snapshot + current mood */
    let azureVoiceName: string | undefined;
    let azureStyle: string | undefined;
    let azureRate: string | undefined;
    let azurePitch: string | undefined;

    try {
      const db = getDb();
      const assessment = db.prepare('SELECT pack_snapshot_json FROM assessments WHERE invite_token = ?').get(params.token) as any;
      if (assessment?.pack_snapshot_json) {
        const snapshot = JSON.parse(assessment.pack_snapshot_json);
        const customer = snapshot?.customer;
        if (customer?.azureVoice) {
          const mood = body.mood || 'neutral';
          const voiceForMood = customer.azureVoice[mood];
          if (voiceForMood) {
            azureVoiceName = voiceForMood.voiceName;
            azureStyle = voiceForMood.style;
            azureRate = voiceForMood.rate;
            azurePitch = voiceForMood.pitch;
          }
        }
        /* Fallback: gender-based voice for OpenRouter */
        if (!azureVoiceName) {
          const gender = customer?.gender || 'female';
          process.env.VOICE_TTS_VOICE = FALLBACK_VOICE_MAP[gender] || 'af_heart';
        }
      }
    } catch { /* use defaults */ }

    /* Override with explicit params from request body */
    if (body.azure_voice) azureVoiceName = body.azure_voice;
    if (body.azure_style) azureStyle = body.azure_style;
    if (body.azure_rate) azureRate = body.azure_rate;
    if (body.azure_pitch) azurePitch = body.azure_pitch;

    const audio = await synthesizeSpeech(text, undefined, {
      voiceName: azureVoiceName,
      style: azureStyle,
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
