import { NextRequest, NextResponse } from 'next/server';
import { getProfile, upsertProfile } from '@/lib/candidate/profile';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const profile = getProfile(userId);
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { userId, displayName, bio, isPublic, showAttempts, showRecordings, showTranscripts, showFeedback, showTicketNotes } = body;
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  try {
    upsertProfile(userId, {
      display_name: displayName,
      bio: bio ?? undefined,
      is_public: isPublic,
      show_attempts: showAttempts,
      show_recordings: showRecordings,
      show_transcripts: showTranscripts,
      show_feedback: showFeedback,
      show_ticket_notes: showTicketNotes,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
