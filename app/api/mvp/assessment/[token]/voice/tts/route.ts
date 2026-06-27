import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';
import { getDb } from '@/lib/mvp/db';

const GENDER_VOICE_MAP: Record<string, string> = {
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

    /* Derive voice from pack snapshot if available */
    let voice = body.voice || undefined;
    if (!voice) {
      try {
        const db = getDb();
        const assessment = db.prepare('SELECT pack_snapshot_json FROM assessments WHERE invite_token = ?').get(params.token) as any;
        if (assessment?.pack_snapshot_json) {
          const snapshot = JSON.parse(assessment.pack_snapshot_json);
          const gender = snapshot?.customer?.gender || 'female';
          voice = GENDER_VOICE_MAP[gender] || 'af_heart';
        }
      } catch { /* fallback to default voice */ }
    }

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
