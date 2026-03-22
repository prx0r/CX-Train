/**
 * API Route: /api/ai/analyze
 * Runs AI analysis on a trainee's performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { analyzeUserProgress, checkLevelProgression, generateTrainingPlan } from '@/lib/ai/feedback-analyzer';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const body = await request.json();
    const { user_id, bot_id = 'call_sim', include_training_plan = true } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Validate API key
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', bot_id)
      .eq('api_key', apiKey)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Run analysis
    const analysis = await analyzeUserProgress(user_id, bot_id);
    
    // Get level progression status
    const progression = await checkLevelProgression(user_id, bot_id);

    // Generate training plan if requested
    let trainingPlan = null;
    if (include_training_plan) {
      trainingPlan = await generateTrainingPlan(user_id, bot_id);
    }

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysis.id,
        patterns: analysis.patterns,
        weaknesses: analysis.weaknesses,
        recommendations: analysis.recommendations,
        suggested_prompt_changes: analysis.suggested_prompt_changes,
        confidence_score: analysis.confidence_score,
        created_at: analysis.created_at,
      },
      progression: {
        current_level: progression.current_level,
        target_level: progression.target_level,
        points_earned: progression.points_earned,
        points_required: progression.points_required,
        progress_percentage: progression.progress_percentage,
        can_level_up: progression.can_level_up,
        requirements_met: progression.requirements_met,
        requirements_pending: progression.requirements_pending,
      },
      training_plan: trainingPlan,
    });
  } catch (err) {
    console.error('AI Analyze API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const bot_id = searchParams.get('bot_id') || 'call_sim';

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Validate API key
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('id', bot_id)
      .eq('api_key', apiKey)
      .single();

    if (botError || !bot) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get recent analyses
    const { data: analyses } = await supabase
      .from('feedback_analysis')
      .select('*')
      .eq('user_id', user_id)
      .eq('bot_id', bot_id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      analyses: analyses || [],
    });
  } catch (err) {
    console.error('AI Analyze GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
