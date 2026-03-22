/**
 * AI Monitor Service
 * Automated pattern detection and training system optimization
 */

import { createServerClient } from '@/lib/supabase';
import {
  runAggregateAnalysis,
  analyzeUserProgress,
  checkLevelProgression,
  promoteUserLevel,
} from './feedback-analyzer';
import { callChutesAI } from './chutes';

export interface MonitorRun {
  id: string;
  bot_id: string;
  monitor_type: 'pattern_detection' | 'prompt_review' | 'aggregate_analysis';
  status: 'running' | 'completed' | 'failed';
  sessions_analyzed: number;
  insights: Record<string, unknown>;
  suggested_actions: string[];
  alert_level: 'info' | 'warning' | 'critical';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

/**
 * Run the AI monitor to detect patterns across all training data
 */
export async function runAIMonitor(
  botId: string = 'call_sim',
  options: {
    autoPromote?: boolean;
    notifyAdmin?: boolean;
    daysBack?: number;
  } = {}
): Promise<MonitorRun> {
  const supabase = createServerClient();

  // Create monitor log entry
  const { data: monitorLog } = await supabase
    .from('ai_monitor_logs')
    .insert({
      bot_id: botId,
      monitor_type: 'aggregate_analysis',
      status: 'running',
      sessions_analyzed: 0,
      alert_level: 'info',
    })
    .select()
    .single();

  const monitorId = monitorLog?.id;

  try {
    // Get recent sessions count
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (options.daysBack || 7));

    const { count: sessionsCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .gte('created_at', cutoffDate.toISOString());

    // Run aggregate analysis
    const analysis = await runAggregateAnalysis(botId, options.daysBack || 7);

    // Analyze individual users who need attention
    const { data: trainees } = await supabase
      .from('trainee_progress')
      .select('user_id, total_sessions, avg_score, level, level_points')
      .eq('bot_id', botId)
      .order('updated_at', { ascending: false })
      .limit(20);

    const userAnalyses: Array<{
      userId: string;
      patterns: string[];
      weaknesses: string[];
      canLevelUp: boolean;
      promoted: boolean;
    }> = [];

    // Check level progression for each trainee
    if (options.autoPromote && trainees) {
      for (const trainee of trainees) {
        const progression = await checkLevelProgression(trainee.user_id, botId);

        if (progression.can_level_up) {
          const result = await promoteUserLevel(trainee.user_id, botId);
          userAnalyses.push({
            userId: trainee.user_id,
            patterns: [],
            weaknesses: [],
            canLevelUp: true,
            promoted: result.success,
          });
        } else if (trainee.total_sessions >= 5) {
          // Only analyze users with enough data
          const analysis = await analyzeUserProgress(trainee.user_id, botId);
          userAnalyses.push({
            userId: trainee.user_id,
            patterns: analysis.patterns,
            weaknesses: analysis.weaknesses,
            canLevelUp: false,
            promoted: false,
          });
        }
      }
    }

    // Determine alert level based on findings
    let alertLevel: 'info' | 'warning' | 'critical' = 'info';
    if (analysis.priority === 'high') {
      alertLevel = 'critical';
    } else if (analysis.priority === 'medium') {
      alertLevel = 'warning';
    }

    // Compile suggested actions
    const suggestedActions: string[] = [];

    if (analysis.suggestedPromptChanges.length > 0) {
      suggestedActions.push(
        `Review ${analysis.suggestedPromptChanges.length} suggested prompt changes`
      );
    }

    const promotedCount = userAnalyses.filter(u => u.promoted).length;
    if (promotedCount > 0) {
      suggestedActions.push(`Auto-promoted ${promotedCount} trainees to next level`);
    }

    const usersNeedingAttention = userAnalyses.filter(
      u => u.weaknesses.length > 0 && !u.canLevelUp
    );
    if (usersNeedingAttention.length > 0) {
      suggestedActions.push(
        `${usersNeedingAttention.length} trainees need additional support`
      );
    }

    // Update monitor log
    const { data: completedLog } = await supabase
      .from('ai_monitor_logs')
      .update({
        status: 'completed',
        sessions_analyzed: sessionsCount || 0,
        insights: {
          aggregate: analysis,
          users: userAnalyses,
          common_weaknesses: analysis.commonWeaknesses,
        },
        suggested_actions: suggestedActions,
        alert_level: alertLevel,
        completed_at: new Date().toISOString(),
      })
      .eq('id', monitorId)
      .select()
      .single();

    return {
      id: monitorId || '',
      bot_id: botId,
      monitor_type: 'aggregate_analysis',
      status: 'completed',
      sessions_analyzed: sessionsCount || 0,
      insights: completedLog?.insights || {},
      suggested_actions: suggestedActions,
      alert_level: alertLevel,
      created_at: monitorLog?.created_at || new Date().toISOString(),
      completed_at: completedLog?.completed_at,
    };
  } catch (error) {
    // Update monitor log with error
    await supabase
      .from('ai_monitor_logs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', monitorId);

    throw error;
  }
}

/**
 * Detect if prompt updates are needed based on recent training data
 */
export async function detectPromptIssues(
  botId: string = 'call_sim',
  daysBack: number = 7
): Promise<{
  needsUpdate: boolean;
  reasons: string[];
  suggestedChanges: string[];
  confidence: number;
}> {
  const supabase = createServerClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('score, passed, checkpoints, score_breakdown, created_at')
    .eq('bot_id', botId)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length < 5) {
    return {
      needsUpdate: false,
      reasons: ['Insufficient data for analysis (need at least 5 sessions)'],
      suggestedChanges: [],
      confidence: 0,
    };
  }

  // Calculate metrics
  const avgScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length;
  const passRate = sessions.filter(s => s.passed).length / sessions.length;

  // Check for systematic checkpoint failures
  const checkpointFailures: Record<string, number> = {};
  for (const session of sessions) {
    for (const [key, value] of Object.entries(session.checkpoints || {})) {
      if (value === false) {
        checkpointFailures[key] = (checkpointFailures[key] || 0) + 1;
      }
    }
  }

  const systematicIssues = Object.entries(checkpointFailures)
    .filter(([_, count]) => count / sessions.length > 0.5)
    .map(([key, count]) => ({
      checkpoint: key,
      failureRate: (count / sessions.length) * 100,
    }));

  // Generate AI analysis
  const prompt = `
You are a training system analyst. Based on the following metrics, determine if the training prompt needs updates.

METRICS (last ${daysBack} days, ${sessions.length} sessions):
- Average Score: ${avgScore.toFixed(1)}/100
- Pass Rate: ${(passRate * 100).toFixed(1)}%
- Systematic Checkpoint Failures: ${systematicIssues.map(i => `${i.checkpoint} (${i.failureRate.toFixed(0)}%)`).join(', ') || 'None'}

Return JSON:
{
  "needsUpdate": true/false,
  "reasons": ["reason 1", "reason 2"],
  "suggestedChanges": ["change 1", "change 2"],
  "confidence": 0.0 to 1.0
}

Rules:
- needsUpdate = true if avgScore < 70 OR passRate < 60% OR >2 systematic issues
- Be specific about which checkpoints are failing
- Suggest concrete prompt improvements
- Confidence based on data volume and consistency
`;

  const aiResponse = await callChutesAI(
    [{ role: 'user', content: prompt }],
    { responseFormat: 'json', maxTokens: 1024 }
  );

  if (!aiResponse.success) {
    return {
      needsUpdate: avgScore < 70 || passRate < 0.6 || systematicIssues.length > 2,
      reasons: systematicIssues.map(i => `${i.checkpoint} failing ${i.failureRate.toFixed(0)}% of the time`),
      suggestedChanges: systematicIssues.map(i => `Add emphasis on ${i.checkpoint} in training prompt`),
      confidence: Math.min(0.9, sessions.length / 20),
    };
  }

  try {
    return JSON.parse(aiResponse.data);
  } catch {
    return {
      needsUpdate: avgScore < 70 || passRate < 0.6 || systematicIssues.length > 2,
      reasons: systematicIssues.map(i => `${i.checkpoint} failing ${i.failureRate.toFixed(0)}% of the time`),
      suggestedChanges: systematicIssues.map(i => `Add emphasis on ${i.checkpoint} in training prompt`),
      confidence: Math.min(0.9, sessions.length / 20),
    };
  }
}

/**
 * Generate a summary report for admin dashboard
 */
export async function generateAdminSummary(
  botId: string = 'call_sim',
  daysBack: number = 7
): Promise<{
  totalSessions: number;
  activeTrainees: number;
  avgScore: number;
  passRate: number;
  levelUpsThisWeek: number;
  topWeaknesses: string[];
  recommendedActions: string[];
  promptUpdateNeeded: boolean;
}> {
  const supabase = createServerClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get session stats
  const { data: sessions } = await supabase
    .from('sessions')
    .select('score, passed, checkpoints')
    .eq('bot_id', botId)
    .gte('created_at', cutoffDate.toISOString());

  const totalSessions = sessions?.length || 0;
  const avgScore = totalSessions > 0 && sessions
    ? sessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalSessions
    : 0;
  const passRate = totalSessions > 0 && sessions
    ? sessions.filter(s => s.passed).length / totalSessions
    : 0;

  // Count active trainees
  const { data: activeTraineesData } = await supabase
    .from('trainee_progress')
    .select('user_id')
    .eq('bot_id', botId)
    .gte('updated_at', cutoffDate.toISOString());

  // Count level ups this week
  const { data: levelUps } = await supabase
    .from('level_history')
    .select('*')
    .eq('bot_id', botId)
    .gte('promoted_at', cutoffDate.toISOString());

  // Aggregate weaknesses
  const weaknessCounts: Record<string, number> = {};
  for (const session of sessions || []) {
    for (const [key, value] of Object.entries(session.checkpoints || {})) {
      if (value === false) {
        weaknessCounts[key] = (weaknessCounts[key] || 0) + 1;
      }
    }
  }

  const topWeaknesses = Object.entries(weaknessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => key);

  // Check if prompt update needed
  const promptCheck = await detectPromptIssues(botId, daysBack);

  // Generate recommendations
  const recommendedActions: string[] = [];

  if (avgScore < 70) {
    recommendedActions.push('Average scores are low - review training materials');
  }
  if (passRate < 0.6) {
    recommendedActions.push('Pass rate below 60% - consider lowering difficulty or improving training');
  }
  if (topWeaknesses.length > 0) {
    recommendedActions.push(`Focus training on: ${topWeaknesses.slice(0, 3).join(', ')}`);
  }
  if (promptCheck.needsUpdate) {
    recommendedActions.push('AI suggests prompt updates based on training patterns');
  }

  return {
    totalSessions,
    activeTrainees: activeTraineesData?.length || 0,
    avgScore: Math.round(avgScore * 10) / 10,
    passRate: Math.round(passRate * 1000) / 10,
    levelUpsThisWeek: levelUps?.length || 0,
    topWeaknesses,
    recommendedActions,
    promptUpdateNeeded: promptCheck.needsUpdate,
  };
}

/**
 * Schedule regular AI monitoring (to be called by cron job)
 */
export async function scheduleRegularMonitoring(
  botId: string = 'call_sim',
  frequency: 'daily' | 'weekly' = 'daily'
): Promise<void> {
  const supabase = createServerClient();

  // Check if we already ran recently
  const { data: recentRun } = await supabase
    .from('ai_monitor_logs')
    .select('created_at')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const minInterval = frequency === 'daily' ? 20 * 60 * 60 * 1000 : 6 * 24 * 60 * 60 * 1000; // 20 hours or 6 days
  const lastRun = recentRun?.created_at ? new Date(recentRun.created_at).getTime() : 0;
  const shouldRun = Date.now() - lastRun > minInterval;

  if (shouldRun) {
    await runAIMonitor(botId, {
      autoPromote: true,
      notifyAdmin: true,
      daysBack: frequency === 'daily' ? 1 : 7,
    });
  }
}

export { runAggregateAnalysis, analyzeUserProgress, checkLevelProgression, promoteUserLevel };
