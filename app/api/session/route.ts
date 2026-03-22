import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabase';
import type { SessionPayload } from '@/lib/types';
import {
  calculateRubricScores,
  calculateScoreFromCheckpoints,
  isPriorityCorrect,
  mergeRubricEvidenceWithCheckpoints,
} from '@/lib/scoring';

const LEVEL_2_THRESHOLD = 40;

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const body: SessionPayload = await request.json();
    const { bot_id, tech_name, pathway_stage, passed, hostname_gathered, impact_gathered, checkpoints } = body;

    if (!bot_id || !tech_name || pathway_stage === undefined || passed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: bot_id, tech_name, pathway_stage, passed' },
        { status: 400 }
      );
    }

    if (!body.rubric_evidence) {
      return NextResponse.json(
        { error: 'Missing required field: rubric_evidence' },
        { status: 400 }
      );
    }

    if (!body.severity_level || !body.impact_level) {
      return NextResponse.json(
        { error: 'Missing required fields: severity_level, impact_level' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Validate API key against bots table
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', bot_id)
      .eq('api_key', apiKey)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const normalizedCheckpoints = checkpoints || {};
    const checkpointScore = calculateScoreFromCheckpoints(normalizedCheckpoints);

    const mergedEvidence = mergeRubricEvidenceWithCheckpoints(body.rubric_evidence, normalizedCheckpoints);
    const scoreBreakdown = calculateRubricScores(mergedEvidence);
    const scorePoints = scoreBreakdown.total_points;

    const priorityEvaluation = isPriorityCorrect(
      body.priority_assigned,
      body.impact_level,
      body.severity_level
    );

    const { data: pathway } = await supabase
      .from('pathways')
      .select('pass_threshold, is_boss_battle')
      .eq('bot_id', bot_id)
      .eq('stage', pathway_stage)
      .single();
    const passThreshold = pathway?.pass_threshold ?? 75;
    const isBossBattle = pathway?.is_boss_battle ?? false;

    // Look up user by full name (case-insensitive)
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', tech_name.trim());

    if (users && users.length > 1) {
      return NextResponse.json(
        { error: 'Multiple users match this name. Please use a unique identifier.' },
        { status: 409 }
      );
    }

    const user = users?.[0] ?? null;

    // If not found, create stub user
    let resolvedUser: { id: string; name: string } | null = user ? { id: user.id, name: user.name } : null;
    if (!resolvedUser) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          clerk_id: `stub_${randomUUID()}`,
          name: tech_name.trim(),
          email: `${tech_name.toLowerCase().replace(/\s/g, '.')}@connexion.training`,
          role: 'trainee',
          is_stub: true,
        })
        .select('id, name')
        .single();

      if (createError || !newUser) {
        console.error('Failed to create stub user:', createError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
      resolvedUser = newUser;
    }

    const pathwayPass = checkpointScore >= passThreshold;

    // Insert session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: resolvedUser.id,
        bot_id,
        pathway_stage,
        personality_id: body.personality_id || null,
        score: checkpointScore,
        score_points: scorePoints,
        score_breakdown: scoreBreakdown,
        rubric_evidence: mergedEvidence,
        passed,
        pathway_pass: pathwayPass,
        checkpoints: normalizedCheckpoints,
        hostname_gathered: hostname_gathered ?? false,
        impact_gathered: impact_gathered ?? false,
        severity_level: body.severity_level ?? null,
        impact_level: body.impact_level ?? null,
        priority_correct: priorityEvaluation.correct ?? body.priority_correct_bool ?? null,
        priority_assigned: body.priority_assigned || null,
        priority_correct_value: (priorityEvaluation.expected ?? body.priority_correct) || null,
        issue_family: body.issue_family || null,
        caller_name: body.caller_name || null,
        caller_company: body.caller_company || null,
        caller_role: body.caller_role || null,
        scope_gathered: body.scope_gathered ?? null,
        intensity: body.intensity ?? null,
        ticket_assessed: body.ticket_assessed ?? false,
        ticket_score: body.ticket_score || null,
        feedback_text: body.feedback_text || null,
        stronger_phrasing: body.stronger_phrasing || [],
        duration_seconds: body.duration_seconds ?? null,
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // Upsert trainee_progress
    const { data: progress } = await supabase
      .from('trainee_progress')
      .select('*')
      .eq('user_id', resolvedUser.id)
      .eq('bot_id', bot_id)
      .single();

    const totalSessions = (progress?.total_sessions ?? 0) + 1;
    const totalPasses = (progress?.total_passes ?? 0) + (passed ? 1 : 0);
    const prevScoreSum =
      progress?.score_sum ??
      Math.round(Number(progress?.avg_score ?? 0) * (progress?.total_sessions ?? 0));
    const scoreSum = prevScoreSum + checkpointScore;
    const avgScore = scoreSum / totalSessions;

    const expectedStage = progress?.current_stage ?? 1;
    const stageMismatch = pathway_stage !== expectedStage;
    let currentStage = expectedStage;
    let highestStagePassed = progress?.highest_stage_passed ?? 0;
    let bossBattleUnlocked = progress?.boss_battle_unlocked ?? false;
    let bossBattleAttempts = progress?.boss_battle_attempts ?? 0;
    let bossBattlePassed = progress?.boss_battle_passed ?? false;

    if (pathwayPass && pathway_stage === currentStage) {
      highestStagePassed = Math.max(highestStagePassed, pathway_stage);
      if (pathway_stage < 10) {
        currentStage = pathway_stage + 1;
      }
      if (highestStagePassed >= 8) {
        bossBattleUnlocked = true;
      }
    }

    if (isBossBattle) {
      bossBattleAttempts += 1;
      if (pathwayPass) {
        bossBattlePassed = true;
      }
    }

    const prevLevel = progress?.level ?? 1;
    // Accumulate points: award points per session based on score (not max of one session)
    // Each passing session earns floor(score/10) points; failing sessions earn 1 point for effort
    const pointsThisSession = passed ? Math.max(1, Math.floor(checkpointScore / 10)) : 1;
    const levelPoints = (progress?.level_points ?? 0) + pointsThisSession;
    const nextLevel = levelPoints >= LEVEL_2_THRESHOLD ? Math.max(prevLevel, 2) : prevLevel;

    await supabase.from('trainee_progress').upsert(
      {
        user_id: resolvedUser.id,
        bot_id,
        current_stage: currentStage,
        highest_stage_passed: highestStagePassed,
        total_sessions: totalSessions,
        total_passes: totalPasses,
        avg_score: avgScore,
        score_sum: scoreSum,
        boss_battle_unlocked: bossBattleUnlocked,
        boss_battle_attempts: bossBattleAttempts,
        boss_battle_passed: bossBattlePassed,
        level: nextLevel,
        level_points: levelPoints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,bot_id' }
    );

    return NextResponse.json({
      success: true,
      ...(stageMismatch
        ? { warning: 'pathway_stage does not match current_stage; progression not applied.' }
        : {}),
      progress: {
        current_stage: currentStage,
        avg_score: Math.round(avgScore * 10) / 10,
        boss_battle_unlocked: bossBattleUnlocked,
        cleared_for_live: progress?.cleared_for_live ?? false,
        level: nextLevel,
        level_points: levelPoints,
      },
    });
  } catch (err) {
    console.error('Session API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
