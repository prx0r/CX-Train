import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/mvp/voice/tts';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await req.json();
    const text = String(body.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    /* Resolve voice from pack snapshot or env default */
    let voice: string | undefined;
    try {
      const { getDb } = await import('@/lib/mvp/db');
      const db = getDb();
      const assessment = db.prepare('SELECT pack_snapshot_json FROM assessments WHERE invite_token = ?').get(params.token) as any;
      if (assessment?.pack_snapshot_json) {
        const snapshot = JSON.parse(assessment.pack_snapshot_json);
        const gender = snapshot?.customer?.gender || 'female';
        voice = gender === 'male' ? 'am_adam' : 'af_heart';
      }
    } catch { /* use default */ }

    const audio = await synthesizeSpeech(text, voice);

    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'Content-Length': String(audio.byteLength),
      },
    });
  } catch (err: any) {
    console.error('[TTS] error:', err.message);
    return NextResponse.json({ error: 'TTS failed', detail: err.message }, { status: 502 });
  }
}
