/**
 * Feedback Analysis System
 * Analyzes training data to detect patterns and suggest improvements
 */

import { createServerClient } from '@/lib/supabase';
import {
  callChutesAI,
  analyzeTrainingPatterns,
  analyzePromptEffectiveness,
  generateLevelScenarios,
} from './chutes';
import type { ScoreBreakdown } from '@/lib/types';

// Analysis result types
export interface FeedbackAnalysis {
  id: string;
  user_id: string;
  bot_id: string;
  analysis_type: 'individual' | 'aggregate' | 'prompt_review';
  patterns: string[];
  weaknesses: string[];
  recommendations: string[];
  suggested_prompt_changes: string[];
  confidence_score: number;
  created_at: string;
  reviewed: boolean;
  approved: boolean;
}

export interface LevelProgression {
  user_id: string;
  current_level: number;
  target_level: number;
  points_earned: number;
  points_required: number;
  progress_percentage: number;
  can_level_up: boolean;
  requirements_met: string[];
  requirements_pending: string[];
}

// Level requirements configuration
export const LEVEL_REQUIREMENTS: Record<number, {
  minPoints: number;
  minSessions: number;
  minAvgScore: number;
  specificSkills: string[];
  description: string;
}> = {
  1: {
    minPoints: 0,
    minSessions: 0,
    minAvgScore: 0,
    specificSkills: [],
    description: 'Basic call handling - information gathering',
  },
  2: {
    minPoints: 40,
    minSessions: 5,
    minAvgScore: 75,
    specificSkills: [
      'hostname_gathered',
      'impact_determined',
      'priority_assigned',
      'scope_determined',
    ],
    description: 'First-call resolution - password resets, account unlocks',
  },
  3: {
    minPoints: 80,
    minSessions: 15,
    minAvgScore: 85,
    specificSkills: [
      'all_level_2_skills',
      'troubleshooting_steps',
      'escalation_decisions',
      'complex_issue_handling',
    ],
    description: 'Advanced troubleshooting - complex issues and escalation',
  },
};

/**
 * Analyze a user's training progress and generate insights
 */
export async function analyzeUserProgress(
  userId: string,
  botId: string = 'call_sim'
): Promise<FeedbackAnalysis> {
  const supabase = createServerClient();

  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single();

  // Get recent sessions for analysis
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!sessions || sessions.length === 0) {
    return {
      id: '',
      user_id: userId,
      bot_id: botId,
      analysis_type: 'individual',
      patterns: [],
      weaknesses: [],
      recommendations: ['Complete more training sessions to generate analysis'],
      suggested_prompt_changes: [],
      confidence_score: 0,
      created_at: new Date().toISOString(),
      reviewed: false,
      approved: false,
    };
  }

  // Use Chutes AI to analyze patterns
  const analysis = await analyzeTrainingPatterns(userId, 10);

  // Store analysis in database
  const { data: savedAnalysis, error } = await supabase
    .from('feedback_analysis')
    .insert({
      user_id: userId,
      bot_id: botId,
      analysis_type: 'individual',
      patterns: analysis.patterns,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      suggested_prompt_changes: analysis.suggestedPromptChanges,
      confidence_score: calculateConfidenceScore(sessions.length),
      reviewed: false,
      approved: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save feedback analysis:', error);
  }

  return {
    id: savedAnalysis?.id || '',
    user_id: userId,
    bot_id: botId,
    analysis_type: 'individual',
    patterns: analysis.patterns,
    weaknesses: analysis.weaknesses,
    recommendations: analysis.recommendations,
    suggested_prompt_changes: analysis.suggestedPromptChanges,
    confidence_score: calculateConfidenceScore(sessions.length),
    created_at: new Date().toISOString(),
    reviewed: false,
    approved: false,
  };
}

/**
 * Calculate confidence score based on data volume
 */
function calculateConfidenceScore(sessionCount: number): number {
  if (sessionCount >= 20) return 0.95;
  if (sessionCount >= 15) return 0.90;
  if (sessionCount >= 10) return 0.85;
  if (sessionCount >= 5) return 0.75;
  return 0.60;
}

/**
 * Check if user can progress to next level
 */
export async function checkLevelProgression(
  userId: string,
  botId: string = 'call_sim'
): Promise<LevelProgression> {
  const supabase = createServerClient();

  // Get current progress
  const { data: progress } = await supabase
    .from('trainee_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('bot_id', botId)
    .single();

  const currentLevel = progress?.level ?? 1;
  const nextLevel = currentLevel + 1;
  const requirements = LEVEL_REQUIREMENTS[nextLevel];

  if (!requirements) {
    // Max level reached
    return {
      user_id: userId,
      current_level: currentLevel,
      target_level: currentLevel,
      points_earned: progress?.level_points ?? 0,
      points_required: 0,
      progress_percentage: 100,
      can_level_up: false,
      requirements_met: ['Maximum level achieved'],
      requirements_pending: [],
    };
  }

  // Get all sessions for comprehensive check
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('bot_id', botId);

  const totalSessions = sessions?.length ?? 0;
  const avgScore = progress?.avg_score ?? 0;
  const currentPoints = progress?.level_points ?? 0;

  const requirementsMet: string[] = [];
  const requirementsPending: string[] = [];

  // Check points requirement
  if (currentPoints >= requirements.minPoints) {
    requirementsMet.push(`Points: ${currentPoints}/${requirements.minPoints}`);
  } else {
    requirementsPending.push(`Points: ${currentPoints}/${requirements.minPoints}`);
  }

  // Check sessions requirement
  if (totalSessions >= requirements.minSessions) {
    requirementsMet.push(`Sessions: ${totalSessions}/${requirements.minSessions}`);
  } else {
    requirementsPending.push(`Sessions: ${totalSessions}/${requirements.minSessions}`);
  }

  // Check average score requirement
  if (avgScore >= requirements.minAvgScore) {
    requirementsMet.push(`Average Score: ${avgScore.toFixed(1)}/${requirements.minAvgScore}`);
  } else {
    requirementsPending.push(`Average Score: ${avgScore.toFixed(1)}/${requirements.minAvgScore}`);
  }

  // Check specific skills (if we have sessions)
  if (sessions && sessions.length > 0) {
    const recentSessions = sessions.slice(-10);
    
    for (const skill of requirements.specificSkills) {
      const skillMastery = calculateSkillMastery(recentSessions, skill);
      if (skillMastery >= 0.8) {
        requirementsMet.push(`Skill mastery: ${skill} (${(skillMastery * 100).toFixed(0)}%)`);
      } else {
        requirementsPending.push(`Skill mastery: ${skill} (${(skillMastery * 100).toFixed(0)}%)`);
      }
    }
  }

  const canLevelUp = requirementsPending.length === 0;
  const progressPercentage = Math.min(
    100,
    Math.round((requirementsMet.length / (requirementsMet.length + requirementsPending.length)) * 100)
  );

  return {
    user_id: userId,
    current_level: currentLevel,
    target_level: nextLevel,
    points_earned: currentPoints,
    points_required: requirements.minPoints,
    progress_percentage: progressPercentage,
    can_level_up: canLevelUp,
    requirements_met: requirementsMet,
    requirements_pending: requirementsPending,
  };
}

/**
 * Calculate mastery percentage for a specific skill
 */
function calculateSkillMastery(
  sessions: Array<{ checkpoints: Record<string, boolean>; score_breakdown: ScoreBreakdown }>,
  skill: string
): number {
  if (sessions.length === 0) return 0;

  let masteredCount = 0;

  for (const session of sessions) {
    // Check checkpoints
    if (skill === 'all_level_2_skills') {
      const l2Skills = ['hostname_gathered', 'impact_determined', 'priority_assigned', 'scope_determined'];
      const allPassed = l2Skills.every(s => session.checkpoints?.[s] === true);
      if (allPassed) masteredCount++;
    } else if (session.checkpoints?.[skill] === true) {
      masteredCount++;
    }
  }

  return masteredCount / sessions.length;
}

/**
 * Promote user to next level if requirements are met
 */
export async function promoteUserLevel(
  userId: string,
  botId: string = 'call_sim',
  adminId?: string
): Promise<{ success: boolean; message: string; newLevel?: number }> {
  const progression = await checkLevelProgression(userId, botId);

  if (!progression.can_level_up) {
    return {
      success: false,
      message: `Cannot level up. Pending requirements: ${progression.requirements_pending.join(', ')}`,
    };
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('trainee_progress')
    .update({
      level: progression.target_level,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('bot_id', botId);

  if (error) {
    console.error('Failed to promote user:', error);
    return { success: false, message: 'Database error during promotion' };
  }

  // Log the level change
  await supabase.from('level_history').insert({
    user_id: userId,
    bot_id: botId,
    previous_level: progression.current_level,
    new_level: progression.target_level,
    promoted_by: adminId || null,
    promoted_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Successfully promoted to Level ${progression.target_level}`,
    newLevel: progression.target_level,
  };
}

/**
 * Run aggregate analysis across all trainees
 */
export async function runAggregateAnalysis(
  botId: string = 'call_sim',
  daysBack: number = 7
): Promise<{
  summary: string;
  commonWeaknesses: string[];
  suggestedPromptChanges: string[];
  priority: 'low' | 'medium' | 'high';
}> {
  const supabase = createServerClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('bot_id', botId)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    return {
      summary: 'No recent sessions to analyze',
      commonWeaknesses: [],
      suggestedPromptChanges: [],
      priority: 'low',
    };
  }

  // Use AI to analyze
  const analysis = await analyzePromptEffectiveness(sessions);

  return {
    summary: analysis.reason,
    commonWeaknesses: analysis.needsPromptUpdate ? analysis.suggestedChanges : [],
    suggestedPromptChanges: analysis.suggestedChanges,
    priority: analysis.priority,
  };
}

/**
 * Generate personalized training recommendations
 */
export async function generateTrainingPlan(
  userId: string,
  botId: string = 'call_sim'
): Promise<{
  focusAreas: string[];
  recommendedScenarios: string[];
  targetMetrics: Record<string, number>;
  estimatedSessionsToLevel: number;
}> {
  const supabase = createServerClient();

  // Get progress and recent analysis
  const { data: progress } = await supabase
    .from('trainee_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('bot_id', botId)
    .single();

  const { data: recentAnalysis } = await supabase
    .from('feedback_analysis')
    .select('*')
    .eq('user_id', userId)
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const currentLevel = progress?.level ?? 1;
  const progression = await checkLevelProgression(userId, botId);

  // Generate scenarios for next level
  const scenarioGen = await generateLevelScenarios(currentLevel, {
    total_sessions: progress?.total_sessions ?? 0,
    avg_score: progress?.avg_score ?? 0,
    level_points: progress?.level_points ?? 0,
    recent_weaknesses: recentAnalysis?.weaknesses ?? [],
  });

  // Calculate estimated sessions needed
  const sessionsRemaining = Math.max(
    0,
    LEVEL_REQUIREMENTS[currentLevel + 1]?.minSessions - (progress?.total_sessions ?? 0)
  );
  const scoreGap = Math.max(
    0,
    LEVEL_REQUIREMENTS[currentLevel + 1]?.minAvgScore - (progress?.avg_score ?? 0)
  );
  const estimatedSessions = Math.max(sessionsRemaining, Math.ceil(scoreGap / 2));

  return {
    focusAreas: recentAnalysis?.weaknesses?.slice(0, 3) ?? ['General call handling'],
    recommendedScenarios: scenarioGen.scenarios.map(s => s.title),
    targetMetrics: {
      targetScore: LEVEL_REQUIREMENTS[currentLevel + 1]?.minAvgScore ?? 85,
      targetSessions: LEVEL_REQUIREMENTS[currentLevel + 1]?.minSessions ?? 10,
      currentScore: progress?.avg_score ?? 0,
      currentSessions: progress?.total_sessions ?? 0,
    },
    estimatedSessionsToLevel: estimatedSessions,
  };
}


