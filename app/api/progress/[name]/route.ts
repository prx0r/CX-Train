import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { CHECKPOINT_KEYS } from '@/lib/types';

// CORS headers for ChatGPT Actions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('bot_id') || 'call_sim';
    const techName = decodeURIComponent((await params).name);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing x-api-key header' },
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createServerClient();

    // Validate API key
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', botId)
      .eq('api_key', apiKey)
      .single();

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Find user by full name (case-insensitive)
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', techName.trim());

    if (!users || users.length === 0) {
      return NextResponse.json(
        {
          found: false,
          tech_name: techName,
        },
        { headers: corsHeaders }
      );
    }
    if (users.length > 1) {
      return NextResponse.json(
        { error: 'Multiple users match this name. Please use a unique identifier.' },
        { status: 409, headers: corsHeaders }
      );
    }
    const user = users[0];

    // Get progress
    const { data: progress } = await supabase
      .from('trainee_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('bot_id', botId)
      .single();

    if (!progress) {
      return NextResponse.json(
        {
          found: true,
          tech_name: user.name,
          current_stage: 1,
          highest_stage_passed: 0,
          total_sessions: 0,
          total_passes: 0,
          avg_score: 0,
          boss_battle_unlocked: false,
          boss_battle_passed: false,
          boss_battle_attempts: 0,
          cleared_for_live: false,
          level: 1,
          level_points: 0,
          recent_weaknesses: [],
          personality_stats: [],
        },
        { headers: corsHeaders }
      );
    }

    // Get last 5 sessions for recent_weaknesses
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('checkpoints')
      .eq('user_id', user.id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentWeaknesses: string[] = [];
    if (recentSessions && recentSessions.length > 0) {
      for (const key of CHECKPOINT_KEYS) {
        const falseCount = recentSessions.filter(
          (s) => (s.checkpoints as Record<string, boolean>)?.[key] === false
        ).length;
        const falseRate = falseCount / recentSessions.length;
        if (falseRate > 0.4) {
          recentWeaknesses.push(key);
        }
      }
    }

    // Get personality stats for this user
    const { data: sessionsWithPersonality } = await supabase
      .from('sessions')
      .select('personality_id, score')
      .eq('user_id', user.id)
      .eq('bot_id', botId)
      .not('personality_id', 'is', null);

    const personalityAgg: Record<string, { total: number; sum: number; count: number }> = {};
    for (const s of sessionsWithPersonality || []) {
      if (s.personality_id) {
        if (!personalityAgg[s.personality_id]) {
          personalityAgg[s.personality_id] = { total: 0, sum: 0, count: 0 };
        }
        personalityAgg[s.personality_id].count++;
        personalityAgg[s.personality_id].sum += s.score ?? 0;
      }
    }

    const personalityIds = Object.keys(personalityAgg);
    const personalityStats: { name: string; archetype: string; avg_score: number }[] = [];

    if (personalityIds.length > 0) {
      const { data: personalities } = await supabase
        .from('personalities')
        .select('id, name, archetype')
        .in('id', personalityIds);

      for (const p of personalities || []) {
        const agg = personalityAgg[p.id];
        if (agg && agg.count > 0) {
          personalityStats.push({
            name: p.name,
            archetype: p.archetype,
            avg_score: Math.round(agg.sum / agg.count),
          });
        }
      }
    }

    return NextResponse.json(
      {
        found: true,
        tech_name: user.name,
        current_stage: progress.current_stage,
        highest_stage_passed: progress.highest_stage_passed,
        total_sessions: progress.total_sessions,
        total_passes: progress.total_passes,
        avg_score: Number(progress.avg_score),
        boss_battle_unlocked: progress.boss_battle_unlocked,
        boss_battle_passed: progress.boss_battle_passed,
        boss_battle_attempts: progress.boss_battle_attempts,
        cleared_for_live: progress.cleared_for_live,
        level: progress.level ?? 1,
        level_points: progress.level_points ?? 0,
        recent_weaknesses: recentWeaknesses,
        personality_stats: personalityStats,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error('Progress API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
