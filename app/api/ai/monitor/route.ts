/**
 * API Route: /api/ai/monitor
 * Run AI monitoring and get insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { 
  runAIMonitor, 
  detectPromptIssues, 
  generateAdminSummary,
  type MonitorRun 
} from '@/lib/ai/monitor';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const body = await request.json();
    const { 
      bot_id = 'call_sim', 
      auto_promote = false,
      days_back = 7 
    } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
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

    // Run the monitor
    const result = await runAIMonitor(bot_id, {
      autoPromote: auto_promote,
      notifyAdmin: true,
      daysBack: days_back,
    });

    return NextResponse.json({
      success: true,
      monitor_run: result,
    });
  } catch (err) {
    console.error('AI Monitor API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('bot_id') || 'call_sim';
    const type = searchParams.get('type') || 'summary';
    const daysBack = parseInt(searchParams.get('days') || '7', 10);

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing x-api-key header' }, { status: 401 });
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

    switch (type) {
      case 'summary':
        const summary = await generateAdminSummary(botId, daysBack);
        return NextResponse.json({
          success: true,
          summary,
        });

      case 'prompt-review':
        const promptCheck = await detectPromptIssues(botId, daysBack);
        return NextResponse.json({
          success: true,
          prompt_review: promptCheck,
        });

      case 'history':
        const { data: logs } = await supabase
          .from('ai_monitor_logs')
          .select('*')
          .eq('bot_id', botId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        return NextResponse.json({
          success: true,
          monitor_history: logs || [],
        });

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (err) {
    console.error('AI Monitor GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
