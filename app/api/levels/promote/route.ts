/**
 * API Route: /api/levels/promote
 * Promote a trainee to the next level (admin only or auto-promote)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { promoteUserLevel, checkLevelProgression } from '@/lib/ai/feedback-analyzer';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const body = await request.json();
    const { user_id, bot_id = 'call_sim', force = false, admin_id } = body;

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

    // Check if promotion is allowed
    if (!force) {
      const progression = await checkLevelProgression(user_id, bot_id);
      
      if (!progression.can_level_up) {
        return NextResponse.json({
          success: false,
          message: 'User does not meet level-up requirements',
          requirements_pending: progression.requirements_pending,
          current_level: progression.current_level,
          target_level: progression.target_level,
        }, { status: 403 });
      }
    }

    // Get current user info for response
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', user_id)
      .single();

    // Perform promotion
    const result = await promoteUserLevel(user_id, bot_id, admin_id);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user_name: user?.name,
      new_level: result.newLevel,
    });
  } catch (err) {
    console.error('Levels Promote API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
