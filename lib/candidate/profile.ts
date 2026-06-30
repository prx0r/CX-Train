import { getDb } from "@/lib/mvp/db";

export interface CandidateProfile {
  user_id: string;
  display_name: string;
  username: string | null;
  bio: string;
  is_public: number;
  show_attempts: number;
  show_recordings: number;
  show_transcripts: number;
  show_feedback: number;
  show_ticket_notes: number;
  created_at: string;
}

export interface AttemptSummary {
  id: string;
  candidate_name: string;
  status: string;
  assignment_type: string;
  attempt_mode: string;
  scenario_title: string | null;
  overall_score: number | null;
  readiness_label: string;
  created_at: string;
  completed_at: string | null;
  has_recording: number;
  pack_title: string | null;
}

export interface FeaturedAttempt {
  id: string;
  assessment_id: string;
  visibility: string;
  show_audio: number;
  show_transcript: number;
  show_feedback: number;
  show_ticket_note: number;
  sort_order: number;
  created_at: string;
  assessment?: AttemptSummary;
}

export function getProfile(userId: string): CandidateProfile | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT cp.*, u.username
    FROM candidate_profiles cp
    LEFT JOIN user u ON u.id = cp.user_id
    WHERE cp.user_id = ?
  `).get(userId) as any;
  return row || null;
}

export function upsertProfile(userId: string, data: Partial<CandidateProfile>): void {
  const db = getDb();
  db.prepare(`
    UPDATE candidate_profiles SET
      display_name = COALESCE(?, display_name),
      bio = COALESCE(?, bio),
      is_public = COALESCE(?, is_public),
      show_attempts = COALESCE(?, show_attempts),
      show_recordings = COALESCE(?, show_recordings),
      show_transcripts = COALESCE(?, show_transcripts),
      show_feedback = COALESCE(?, show_feedback),
      show_ticket_notes = COALESCE(?, show_ticket_notes),
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    data.display_name ?? null,
    data.bio ?? null,
    data.is_public ?? null,
    data.show_attempts ?? null,
    data.show_recordings ?? null,
    data.show_transcripts ?? null,
    data.show_feedback ?? null,
    data.show_ticket_notes ?? null,
    userId
  );
}

export function getAttempts(userId: string, limit = 50): AttemptSummary[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.id,
      a.candidate_name,
      a.status,
      a.assignment_type,
      a.attempt_mode,
      COALESCE(ap.title, hp.title, a.title) as scenario_title,
      ar.overall_score,
      ar.readiness_label,
      a.created_at,
      a.completed_at,
      CASE WHEN ar.recording_path IS NOT NULL THEN 1 ELSE 0 END as has_recording,
      COALESCE(ap.title, hp.title) as pack_title
    FROM assessments a
    LEFT JOIN assessment_results ar ON ar.assessment_id = a.id
    LEFT JOIN assessment_packs ap ON ap.id = a.assessment_pack_id
    LEFT JOIN assessment_packs hp ON hp.id = a.assessment_pack_id
    WHERE a.candidate_user_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(userId, limit) as AttemptSummary[];
}

export function getFeaturedAttempts(userId: string): FeaturedAttempt[] {
  const db = getDb();
  return db.prepare(`
    SELECT fa.*,
      a.candidate_name,
      a.status,
      a.assignment_type,
      a.attempt_mode,
      COALESCE(ap.title, a.title) as pack_title,
      ar.overall_score,
      ar.readiness_label,
      a.created_at as assessment_created_at,
      CASE WHEN ar.recording_path IS NOT NULL THEN 1 ELSE 0 END as has_recording
    FROM featured_attempts fa
    JOIN assessments a ON a.id = fa.assessment_id
    LEFT JOIN assessment_results ar ON ar.assessment_id = a.id
    LEFT JOIN assessment_packs ap ON ap.id = a.assessment_pack_id
    WHERE fa.candidate_user_id = ?
    ORDER BY fa.sort_order ASC, fa.created_at DESC
  `).all(userId) as any;
}

export function toggleFeatured(userId: string, assessmentId: string, featured: boolean): void {
  const db = getDb();
  if (featured) {
    const existing = db.prepare(
      'SELECT id FROM featured_attempts WHERE candidate_user_id = ? AND assessment_id = ?'
    ).get(userId, assessmentId);
    if (!existing) {
      const maxOrder = db.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 FROM featured_attempts WHERE candidate_user_id = ?'
      ).get(userId) as number;
      db.prepare(`
        INSERT INTO featured_attempts (candidate_user_id, assessment_id, sort_order)
        VALUES (?, ?, ?)
      `).run(userId, assessmentId, maxOrder);
    }
  } else {
    db.prepare(
      'DELETE FROM featured_attempts WHERE candidate_user_id = ? AND assessment_id = ?'
    ).run(userId, assessmentId);
  }
}

export function updateFeaturedSettings(
  userId: string,
  assessmentId: string,
  settings: Partial<{ visibility: string; show_audio: number; show_transcript: number; show_feedback: number; show_ticket_note: number }>
): void {
  const db = getDb();
  db.prepare(`
    UPDATE featured_attempts SET
      visibility = COALESCE(?, visibility),
      show_audio = COALESCE(?, show_audio),
      show_transcript = COALESCE(?, show_transcript),
      show_feedback = COALESCE(?, show_feedback),
      show_ticket_note = COALESCE(?, show_ticket_note)
    WHERE candidate_user_id = ? AND assessment_id = ?
  `).run(
    settings.visibility ?? null,
    settings.show_audio ?? null,
    settings.show_transcript ?? null,
    settings.show_feedback ?? null,
    settings.show_ticket_note ?? null,
    userId,
    assessmentId
  );
}

export function getPublicProfile(username: string): { profile: CandidateProfile | null; attempts: AttemptSummary[] } {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, name, email, bio FROM user WHERE username = ?'
  ).get(username) as any;
  if (!user) return { profile: null, attempts: [] };

  const profile = db.prepare(`
    SELECT * FROM candidate_profiles WHERE user_id = ?
  `).get(user.id) as CandidateProfile | undefined;

  if (!profile || !profile.is_public) return { profile: null, attempts: [] };

  const featuredIds = db.prepare(`
    SELECT assessment_id FROM featured_attempts
    WHERE candidate_user_id = ? AND visibility = 'public'
    ORDER BY sort_order ASC
  `).all(user.id).map((r: any) => r.assessment_id);

  let attempts: AttemptSummary[] = [];
  if (featuredIds.length > 0) {
    const placeholders = featuredIds.map(() => '?').join(',');
    attempts = db.prepare(`
      SELECT a.id, a.candidate_name, a.status, a.assignment_type, a.attempt_mode,
        COALESCE(ap.title, a.title) as scenario_title,
        ar.overall_score, ar.readiness_label, a.created_at, a.completed_at,
        CASE WHEN ar.recording_path IS NOT NULL THEN 1 ELSE 0 END as has_recording,
        COALESCE(ap.title, a.title) as pack_title
      FROM assessments a
      LEFT JOIN assessment_results ar ON ar.assessment_id = a.id
      LEFT JOIN assessment_packs ap ON ap.id = a.assessment_pack_id
      WHERE a.id IN (${placeholders})
      ORDER BY a.created_at DESC
    `).all(...featuredIds) as AttemptSummary[];
  }

  return {
    profile: { ...profile, username: user.username, display_name: user.name, bio: user.bio || '' },
    attempts,
  };
}
