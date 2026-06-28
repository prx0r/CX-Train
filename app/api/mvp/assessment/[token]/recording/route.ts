import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mvp/db';
import { saveRecording, getRecordingStream, deleteRecording } from '@/lib/mvp/audio/recorder';
import { analyzeAudio } from '@/lib/mvp/audio/analyzer';
import { runDiarization, diarizationAvailable } from '@/lib/mvp/audio/diarizer';
import { buildEmotionalTrajectory, buildEmotionalEvidence } from '@/lib/mvp/analysis/emotionalState';
import { getAssessmentByToken, getSessionByAssessment } from '@/lib/mvp/query';

const MAX_RECORDING_SIZE = 50 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const form = await req.formData();
    const file = form.get('audio');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 });
    }

    if (file.size > MAX_RECORDING_SIZE) {
      return NextResponse.json(
        { error: `Recording too large: ${file.size} bytes (max ${MAX_RECORDING_SIZE})` },
        { status: 413 },
      );
    }

    const durationMs = (() => {
      const raw = form.get('duration_ms');
      if (raw) return parseInt(String(raw), 10) || 0;
      return 0;
    })();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const recording = saveRecording(buffer, params.token, durationMs);

    const audioBytes = new Uint8Array(arrayBuffer);

    const analysis = await analyzeAudio(audioBytes);

    /* Run speaker diarization if models are available */
    let diarization = null;
    if (diarizationAvailable()) {
      try {
        diarization = await runDiarization(audioBytes, 16000);
      } catch (err) {
        console.warn('[Recording] Diarization failed (non-fatal):', err);
      }
    }

    /* Build emotional trajectory from session events */
    let emotionalTrajectory = null;
    let emotionalEvidence = null;
    try {
      const assessment = getAssessmentByToken(params.token);
      if (assessment) {
        const session = getSessionByAssessment(assessment.id);
        if (session) {
          emotionalTrajectory = buildEmotionalTrajectory(session.id);
          if (emotionalTrajectory) {
            emotionalEvidence = buildEmotionalEvidence(emotionalTrajectory);
          }
        }
      }
    } catch (err) {
      console.warn('[Recording] Emotional analysis failed (non-fatal):', err);
    }

    const combined = { ...analysis, diarization, emotionalTrajectory, emotionalEvidence };

    const db = getDb();
    db.prepare(`
      UPDATE assessment_results
      SET recording_path = ?, recording_analysis_json = ?
      WHERE assessment_id = (SELECT id FROM assessments WHERE invite_token = ?)
    `).run(recording.filePath, JSON.stringify(combined), params.token);

    return NextResponse.json({
      id: recording.id,
      path: recording.filePath,
      sizeBytes: recording.sizeBytes,
      analysis: {
        durationMs: analysis.durationMs,
        silenceRatio: analysis.silenceRatio,
        talkRatio: analysis.talkRatio,
        longestSilenceMs: analysis.longestSilenceMs,
        silenceSegments: analysis.silenceSegments,
        diarization: diarization ? {
          numSpeakers: diarization.numSpeakers,
          speakerLabels: diarization.speakerLabels,
          perSpeakerMetrics: diarization.perSpeakerMetrics,
        } : null,
      },
    });
  } catch (err: any) {
    console.error('[Recording] Upload error:', err.message);
    return NextResponse.json(
      { error: 'Recording upload failed', detail: err.message },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const db = getDb();
    const result = db.prepare(`
      SELECT recording_path FROM assessment_results
      WHERE assessment_id = (SELECT id FROM assessments WHERE invite_token = ?)
        AND recording_path IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(params.token) as { recording_path: string } | undefined;

    if (!result) {
      return NextResponse.json({ error: 'No recording found' }, { status: 404 });
    }

    const pathParts = result.recording_path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const tokenDash = `${params.token}-`;
    const id = fileName.startsWith(tokenDash)
      ? fileName.replace(tokenDash, '').replace('.webm', '')
      : fileName.replace('.webm', '');

    const { getRecordingStream: streamRecording } = await import('@/lib/mvp/audio/recorder');
    const stream = streamRecording(params.token, id);

    if (!stream) {
      return NextResponse.json({ error: 'Recording file not found on disk' }, { status: 404 });
    }

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'audio/webm',
        'Content-Disposition': `inline; filename="call-${params.token}.webm"`,
      },
    });
  } catch (err: any) {
    console.error('[Recording] Get error:', err.message);
    return NextResponse.json(
      { error: 'Failed to retrieve recording' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const db = getDb();
    const result = db.prepare(`
      SELECT recording_path FROM assessment_results
      WHERE assessment_id = (SELECT id FROM assessments WHERE invite_token = ?)
        AND recording_path IS NOT NULL
    `).get(params.token) as { recording_path: string } | undefined;

    if (!result) {
      return NextResponse.json({ error: 'No recording found' }, { status: 404 });
    }

    const pathParts = result.recording_path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const tokenDash = `${params.token}-`;
    const id = fileName.startsWith(tokenDash)
      ? fileName.replace(tokenDash, '').replace('.webm', '')
      : fileName.replace('.webm', '');

    const deleted = deleteRecording(params.token, id);

    db.prepare(`
      UPDATE assessment_results
      SET recording_path = NULL, recording_analysis_json = NULL
      WHERE assessment_id = (SELECT id FROM assessments WHERE invite_token = ?)
    `).run(params.token);

    return NextResponse.json({ deleted });
  } catch (err: any) {
    console.error('[Recording] Delete error:', err.message);
    return NextResponse.json({ error: 'Failed to delete recording' }, { status: 500 });
  }
}
