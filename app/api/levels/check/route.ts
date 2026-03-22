/**
 * API Route: /api/levels/check
 * Check level progression status for a trainee
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkLevelProgression, LEVEL_REQUIREMENTS } from '@/lib/ai/feedback-analyzer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('bot_id') || 'call_sim';
    const techName = searchParams.get('name') || '';

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
    }

    if (!techName) {
      return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
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
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Find user by name
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', techName.trim());

    if (!users || users.length === 0) {
      return NextResponse.json({
        found: false,
        tech_name: techName,
        message: 'User not found',
      });
    }

    if (users.length > 1) {
      return NextResponse.json(
        { error: 'Multiple users match this name. Please use a unique identifier.' },
        { status: 409 }
      );
    }

    const user = users[0];

    // Check level progression
    const progression = await checkLevelProgression(user.id, botId);

    // Get level requirements
    const nextLevelReqs = LEVEL_REQUIREMENTS[progression.target_level];

    return NextResponse.json({
      found: true,
      tech_name: user.name,
      user_id: user.id,
      current_level: progression.current_level,
      target_level: progression.target_level,
      points_earned: progression.points_earned,
      points_required: progression.points_required,
      progress_percentage: progression.progress_percentage,
      can_level_up: progression.can_level_up,
      requirements_met: progression.requirements_met,
      requirements_pending: progression.requirements_pending,
      next_level_description: nextLevelReqs?.description || 'Master level achieved',
      level_requirements: nextLevelReqs,
    });
  } catch (err) {
    console.error('Levels Check API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
