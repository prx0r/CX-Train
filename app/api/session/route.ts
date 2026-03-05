import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { SessionPayload } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    const body: SessionPayload = await request.json();
    const { bot_id, tech_name, pathway_stage, score, passed, hostname_gathered, impact_gathered, checkpoints } = body;

    if (!bot_id || !tech_name || pathway_stage === undefined || score === undefined || passed === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: bot_id, tech_name, pathway_stage, score, passed' },
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

    // Look up user by tech_name (case-insensitive, match first name)
    const nameParts = tech_name.trim().split(/\s+/);
    const firstName = nameParts[0]?.toLowerCase() || tech_name.toLowerCase();

    let { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('name', `${firstName}%`)
      .limit(1)
      .single();

    // If not found, create stub user
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          clerk_id: `stub_${Date.now()}_${tech_name.replace(/\s/g, '_')}`,
          name: tech_name,
          email: `${tech_name.toLowerCase().replace(/\s/g, '.')}@connexion.training`,
          role: 'trainee',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Failed to create stub user:', createError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
      user = newUser;
    }

    const pathwayPass = passed; // Simplified: passed means pathway passed for this stage

    // Insert session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        bot_id,
        pathway_stage,
        personality_id: body.personality_id || null,
        score,
        passed,
        pathway_pass: pathwayPass,
        checkpoints: checkpoints || {},
        hostname_gathered: hostname_gathered ?? false,
        impact_gathered: impact_gathered ?? false,
        priority_correct: body.priority_correct_bool ?? null,
        priority_assigned: body.priority_assigned || null,
        priority_correct_value: body.priority_correct || null,
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
      .eq('user_id', user.id)
      .eq('bot_id', bot_id)
      .single();

    const totalSessions = (progress?.total_sessions ?? 0) + 1;
    const totalPasses = (progress?.total_passes ?? 0) + (passed ? 1 : 0);
    const avgScore = progress
      ? ((Number(progress.avg_score) * (totalSessions - 1) + score) / totalSessions)
      : score;

    let currentStage = progress?.current_stage ?? 1;
    let highestStagePassed = progress?.highest_stage_passed ?? 0;
    let bossBattleUnlocked = progress?.boss_battle_unlocked ?? false;

    if (passed && pathway_stage === currentStage) {
      highestStagePassed = Math.max(highestStagePassed, pathway_stage);
      if (pathway_stage < 10) {
        currentStage = pathway_stage + 1;
      }
      // Boss battle unlocked when stages 1-8 all passed
      if (highestStagePassed >= 8) {
        bossBattleUnlocked = true;
      }
    }

    await supabase.from('trainee_progress').upsert(
      {
        user_id: user.id,
        bot_id,
        current_stage: currentStage,
        highest_stage_passed: highestStagePassed,
        total_sessions: totalSessions,
        total_passes: totalPasses,
        avg_score: avgScore,
        boss_battle_unlocked: bossBattleUnlocked,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,bot_id' }
    );

    return NextResponse.json({
      success: true,
      progress: {
        current_stage: currentStage,
        avg_score: Math.round(avgScore * 10) / 10,
        boss_battle_unlocked: bossBattleUnlocked,
        cleared_for_live: progress?.cleared_for_live ?? false,
      },
    });
  } catch (err) {
    console.error('Session API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
