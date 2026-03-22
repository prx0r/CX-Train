/**
 * Chutes AI Integration Module
 * Provides LLM capabilities for analyzing training data and generating insights
 * WITH COMPREHENSIVE DEBUGGING AND VALIDATION
 */

import { createServerClient } from '@/lib/supabase';

const CHUTES_API_URL = process.env.CHUTES_API_URL || 'https://llm.chutes.ai/v1';
const CHUTES_API_KEY = process.env.CHUTES_API_KEY || '';
const CHUTES_MODEL = process.env.CHUTES_MODEL || 'moonshotai/Kimi-K2.5-TEE';

// Debug configuration
const DEBUG = process.env.AI_DEBUG === 'true' || process.env.NODE_ENV === 'development';

interface ChutesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChutesRequest {
  model: string;
  messages: ChutesMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' };
  stream?: boolean;
}

interface ChutesResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}

// Validation utilities
function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!CHUTES_API_KEY || CHUTES_API_KEY === 'your_chutes_api_key_here') {
    errors.push('CHUTES_API_KEY is not configured');
  }
  
  if (!CHUTES_API_URL) {
    errors.push('CHUTES_API_URL is not configured');
  }
  
  if (!CHUTES_MODEL) {
    errors.push('CHUTES_MODEL is not configured');
  }
  
  return { valid: errors.length === 0, errors };
}

function logDebug(context: string, data: unknown): void {
  if (DEBUG) {
    console.log(`[AI DEBUG] ${context}:`, JSON.stringify(data, null, 2));
  }
}

function logError(context: string, error: unknown): void {
  console.error(`[AI ERROR] ${context}:`, error);
  if (error instanceof Error) {
    console.error(`[AI ERROR] Stack:`, error.stack);
  }
}

/**
 * Make a call to Chutes AI API with full validation and debugging
 */
export async function callChutesAI(
  messages: ChutesMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
    responseFormat?: 'json';
    context?: string;
  } = {}
): Promise<{ success: boolean; data: string; error?: string; metadata?: Record<string, unknown> }> {
  const startTime = Date.now();
  const context = options.context || 'unknown';
  
  logDebug(`[${context}] Starting Chutes AI call`, {
    messageCount: messages.length,
    model: CHUTES_MODEL,
    options,
  });

  // Validate environment
  const envCheck = validateEnvironment();
  if (!envCheck.valid) {
    logError(`[${context}] Environment validation failed`, envCheck.errors);
    return {
      success: false,
      data: '',
      error: `Environment validation failed: ${envCheck.errors.join(', ')}`,
    };
  }

  // Validate inputs
  if (!messages || messages.length === 0) {
    logError(`[${context}] Invalid input: empty messages array`, new Error('Empty messages'))
    return {
      success: false,
      data: '',
      error: 'Messages array is empty',
    };
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
      logError(`[${context}] Invalid message role at index ${i}`, msg);
      return {
        success: false,
        data: '',
        error: `Invalid role in message ${i}: ${msg.role}`,
      };
    }
    if (!msg.content || typeof msg.content !== 'string') {
      logError(`[${context}] Invalid message content at index ${i}`, msg);
      return {
        success: false,
        data: '',
        error: `Invalid content in message ${i}`,
      };
    }
  }

  const requestBody: ChutesRequest = {
    model: CHUTES_MODEL,
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
  };

  if (options.responseFormat === 'json') {
    requestBody.response_format = { type: 'json_object' };
  }

  logDebug(`[${context}] Request body`, {
    url: CHUTES_API_URL,
    bodyLength: JSON.stringify(requestBody).length,
    hasAuth: !!CHUTES_API_KEY,
  });

  try {
    const response = await fetch(`${CHUTES_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHUTES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    
    logDebug(`[${context}] Response received`, {
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`[${context}] HTTP error ${response.status}`, errorText);
      return {
        success: false,
        data: '',
        error: `Chutes AI API error: ${response.status} - ${errorText}`,
        metadata: { status: response.status, duration },
      };
    }

    let data: ChutesResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      logError(`[${context}] Failed to parse response JSON`, parseError);
      return {
        success: false,
        data: '',
        error: 'Failed to parse API response',
      };
    }

    logDebug(`[${context}] Response parsed`, {
      hasChoices: !!data.choices,
      choiceCount: data.choices?.length,
      hasError: !!data.error,
    });

    if (data.error) {
      logError(`[${context}] API returned error`, data.error);
      return {
        success: false,
        data: '',
        error: data.error.message || 'Unknown API error',
        metadata: { errorType: data.error.type },
      };
    }

    const content = data.choices?.[0]?.message?.content;
    
    if (!content || typeof content !== 'string') {
      logError(`[${context}] No content in response`, data);
      return {
        success: false,
        data: '',
        error: 'No content in API response',
      };
    }

    logDebug(`[${context}] Success`, {
      contentLength: content.length,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      data: content,
      metadata: {
        duration,
        tokensUsed: content.length / 4, // Rough estimate
        model: CHUTES_MODEL,
      },
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    logError(`[${context}] Exception during API call`, err);
    return {
      success: false,
      data: '',
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: { duration, exception: true },
    };
  }
}

/**
 * Analyze training patterns across sessions with validation
 */
export async function analyzeTrainingPatterns(
  userId: string,
  sessionCount: number = 10
): Promise<{
  success: boolean;
  patterns: string[];
  weaknesses: string[];
  recommendations: string[];
  suggestedPromptChanges: string[];
  error?: string;
  debug?: Record<string, unknown>;
}> {
  logDebug('analyzeTrainingPatterns started', { userId, sessionCount });

  // Validate inputs
  if (!userId || typeof userId !== 'string') {
    logError('Invalid userId', userId);
    return {
      success: false,
      patterns: [],
      weaknesses: [],
      recommendations: [],
      suggestedPromptChanges: [],
      error: 'Invalid userId',
    };
  }

  if (!Number.isInteger(sessionCount) || sessionCount < 1 || sessionCount > 100) {
    logError('Invalid sessionCount', sessionCount);
    return {
      success: false,
      patterns: [],
      weaknesses: [],
      recommendations: [],
      suggestedPromptChanges: [],
      error: 'Invalid sessionCount: must be between 1 and 100',
    };
  }

  const supabase = createServerClient();

  try {
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logError('User not found', { userId, error: userError });
      return {
        success: false,
        patterns: [],
        weaknesses: [],
        recommendations: [],
        suggestedPromptChanges: [],
        error: `User not found: ${userId}`,
      };
    }

    // Fetch recent sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(sessionCount);

    if (sessionsError) {
      logError('Failed to fetch sessions', sessionsError);
      return {
        success: false,
        patterns: [],
        weaknesses: [],
        recommendations: [],
        suggestedPromptChanges: [],
        error: `Database error: ${sessionsError.message}`,
      };
    }

    if (!sessions || sessions.length === 0) {
      logDebug('No sessions found for user', { userId });
      return {
        success: true,
        patterns: [],
        weaknesses: [],
        recommendations: ['Complete more training sessions to generate analysis'],
        suggestedPromptChanges: [],
        debug: { userFound: true, sessionCount: 0 },
      };
    }

    logDebug('Sessions fetched', { count: sessions.length });

    // Prepare sanitized data for AI
    const sanitizedSessions = sessions.map((s, idx) => ({
      index: idx,
      score: s.score,
      passed: s.passed,
      hasCheckpoints: !!s.checkpoints,
      checkpointCount: s.checkpoints ? Object.keys(s.checkpoints).length : 0,
      hasScoreBreakdown: !!s.score_breakdown,
      created_at: s.created_at,
    }));

    const prompt = `
You are an expert helpdesk training analyst. Analyze the following training session data and identify patterns.

TRAINEE: ${user.name}
SESSIONS ANALYZED: ${sessions.length}

SESSIONS DATA (sanitized):
${JSON.stringify(sanitizedSessions, null, 2)}

DETAILED SESSION DATA:
${JSON.stringify(sessions.map(s => ({
  score: s.score,
  passed: s.passed,
  checkpoints: s.checkpoints,
  score_breakdown: s.score_breakdown,
  rubric_evidence: s.rubric_evidence,
})), null, 2)}

Analyze and return a JSON object with these fields:
{
  "patterns": ["pattern 1", "pattern 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "recommendations": ["recommendation 1", ...],
  "suggestedPromptChanges": ["specific prompt change suggestion 1", ...]
}

Focus on:
1. Recurring mistakes or missed checkpoints
2. Score trends across sessions
3. Specific skill gaps (professionalism, friendliness, qualification, etc.)
4. Actionable suggestions for the GPT prompt to address these issues

If insufficient data, return empty arrays with a note in recommendations.
`;

    const aiResponse = await callChutesAI(
      [{ role: 'user', content: prompt }],
      { responseFormat: 'json', maxTokens: 2048, context: 'analyzeTrainingPatterns' }
    );

    if (!aiResponse.success) {
      return {
        success: false,
        patterns: [],
        weaknesses: [],
        recommendations: [],
        suggestedPromptChanges: [],
        error: aiResponse.error,
        debug: { aiCallFailed: true, metadata: aiResponse.metadata },
      };
    }

    let analysis: {
      patterns?: string[];
      weaknesses?: string[];
      recommendations?: string[];
      suggestedPromptChanges?: string[];
    };

    try {
      analysis = JSON.parse(aiResponse.data);
    } catch (parseError) {
      logError('Failed to parse AI response JSON', { response: aiResponse.data, error: parseError });
      return {
        success: false,
        patterns: [],
        weaknesses: [],
        recommendations: [],
        suggestedPromptChanges: [],
        error: 'Failed to parse AI analysis response',
        debug: { rawResponse: aiResponse.data },
      };
    }

    // Validate response structure
    const result = {
      success: true,
      patterns: Array.isArray(analysis.patterns) ? analysis.patterns : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
      suggestedPromptChanges: Array.isArray(analysis.suggestedPromptChanges) ? analysis.suggestedPromptChanges : [],
      debug: {
        sessionsAnalyzed: sessions.length,
        aiCallDuration: aiResponse.metadata?.duration,
        userName: user.name,
      },
    };

    logDebug('Analysis complete', result);
    return result;

  } catch (err) {
    logError('Unexpected error in analyzeTrainingPatterns', err);
    return {
      success: false,
      patterns: [],
      weaknesses: [],
      recommendations: [],
      suggestedPromptChanges: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Generate feedback for a specific session with validation
 */
export async function generateSessionFeedback(
  sessionData: {
    checkpoints: Record<string, boolean>;
    score_breakdown: Record<string, number>;
    rubric_evidence: Record<string, boolean>;
    caller_scenario: string;
  }
): Promise<{
  success: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  actionItems: string[];
  error?: string;
}> {
  logDebug('generateSessionFeedback started', { scenario: sessionData.caller_scenario });

  // Validate inputs
  if (!sessionData || typeof sessionData !== 'object') {
    return {
      success: false,
      summary: '',
      strengths: [],
      improvements: [],
      actionItems: [],
      error: 'Invalid sessionData: must be an object',
    };
  }

  if (!sessionData.caller_scenario || typeof sessionData.caller_scenario !== 'string') {
    return {
      success: false,
      summary: '',
      strengths: [],
      improvements: [],
      actionItems: [],
      error: 'Invalid caller_scenario: must be a non-empty string',
    };
  }

  const prompt = `
You are a constructive helpdesk training coach. Review this training session and provide feedback.

SESSION DATA:
${JSON.stringify(sessionData, null, 2)}

Provide constructive feedback as JSON:
{
  "summary": "Overall assessment in 2-3 sentences",
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["area to improve 1", "area to improve 2", ...],
  "actionItems": ["specific action 1", "specific action 2", ...]
}

Be encouraging but honest. Focus on specific behaviors and skills.
`;

  const aiResponse = await callChutesAI(
    [{ role: 'user', content: prompt }],
    { responseFormat: 'json', maxTokens: 1536, context: 'generateSessionFeedback' }
  );

  if (!aiResponse.success) {
    return {
      success: false,
      summary: '',
      strengths: [],
      improvements: [],
      actionItems: [],
      error: aiResponse.error,
    };
  }

  try {
    const feedback = JSON.parse(aiResponse.data);
    return {
      success: true,
      summary: feedback.summary || 'Feedback generated',
      strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
      improvements: Array.isArray(feedback.improvements) ? feedback.improvements : [],
      actionItems: Array.isArray(feedback.actionItems) ? feedback.actionItems : [],
    };
  } catch {
    return {
      success: false,
      summary: '',
      strengths: [],
      improvements: [],
      actionItems: [],
      error: 'Failed to parse feedback JSON',
    };
  }
}

/**
 * Analyze if prompt changes are needed based on aggregate data
 */
export async function analyzePromptEffectiveness(
  sessionsData: Array<{
    score: number;
    passed: boolean;
    checkpoints: Record<string, boolean>;
    score_breakdown: Record<string, number>;
    created_at: string;
  }>
): Promise<{
  success: boolean;
  needsPromptUpdate: boolean;
  reason: string;
  suggestedChanges: string[];
  priority: 'low' | 'medium' | 'high';
  error?: string;
}> {
  logDebug('analyzePromptEffectiveness started', { sessionCount: sessionsData?.length });

  // Validate inputs
  if (!Array.isArray(sessionsData) || sessionsData.length < 5) {
    return {
      success: false,
      needsPromptUpdate: false,
      reason: 'Insufficient data for analysis (need at least 5 sessions)',
      suggestedChanges: [],
      priority: 'low',
      error: 'Insufficient data: need at least 5 sessions',
    };
  }

  const avgScore = sessionsData.reduce((a, s) => a + (s.score || 0), 0) / sessionsData.length;
  const passRate = sessionsData.filter(s => s.passed).length / sessionsData.length;

  const prompt = `
You are a training system analyst. Based on the following metrics, determine if the training prompt needs updates.

METRICS (${sessionsData.length} sessions):
- Average Score: ${avgScore.toFixed(1)}/100
- Pass Rate: ${(passRate * 100).toFixed(1)}%

AGGREGATE DATA (last 5 sessions):
${JSON.stringify(sessionsData.slice(-5).map(s => ({
    score: s.score,
    passed: s.passed,
    checkpoints: s.checkpoints,
    score_breakdown: s.score_breakdown,
  })), null, 2)}

Analyze and return JSON:
{
  "needsPromptUpdate": true/false,
  "reason": "explanation of why changes are/aren't needed",
  "suggestedChanges": ["specific change 1", "specific change 2", ...],
  "priority": "low" | "medium" | "high"
}

Rules:
- needsUpdate = true if avgScore < 70 OR passRate < 60%
- Be specific about what needs to change
- Suggest concrete prompt improvements
`;

  const aiResponse = await callChutesAI(
    [{ role: 'user', content: prompt }],
    { responseFormat: 'json', maxTokens: 1536, context: 'analyzePromptEffectiveness' }
  );

  if (!aiResponse.success) {
    return {
      success: false,
      needsPromptUpdate: false,
      reason: 'Analysis failed',
      suggestedChanges: [],
      priority: 'low',
      error: aiResponse.error,
    };
  }

  try {
    const analysis = JSON.parse(aiResponse.data);
    return {
      success: true,
      needsPromptUpdate: analysis.needsPromptUpdate ?? false,
      reason: analysis.reason || 'Analysis completed',
      suggestedChanges: Array.isArray(analysis.suggestedChanges) ? analysis.suggestedChanges : [],
      priority: ['low', 'medium', 'high'].includes(analysis.priority) ? analysis.priority : 'low',
    };
  } catch {
    return {
      success: false,
      needsPromptUpdate: false,
      reason: 'Failed to parse analysis',
      suggestedChanges: [],
      priority: 'low',
      error: 'JSON parse error',
    };
  }
}

/**
 * Generate next-level training scenarios based on progress
 */
export async function generateLevelScenarios(
  currentLevel: number,
  traineeProgress: {
    total_sessions: number;
    avg_score: number;
    level_points: number;
    recent_weaknesses: string[];
  }
): Promise<{
  success: boolean;
  scenarios: Array<{
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    focus_areas: string[];
    success_criteria: string[];
  }>;
  levelUpRequirements: string[];
  error?: string;
}> {
  logDebug('generateLevelScenarios started', { currentLevel, traineeProgress });

  // Validate inputs
  if (!Number.isInteger(currentLevel) || currentLevel < 1 || currentLevel > 10) {
    return {
      success: false,
      scenarios: [],
      levelUpRequirements: [],
      error: 'Invalid currentLevel: must be between 1 and 10',
    };
  }

  if (!traineeProgress || typeof traineeProgress !== 'object') {
    return {
      success: false,
      scenarios: [],
      levelUpRequirements: [],
      error: 'Invalid traineeProgress: must be an object',
    };
  }

  const levelDescriptions: Record<number, string> = {
    1: 'Basic call handling - information gathering, scope/impact assessment, priority setting',
    2: 'First-call resolution - password resets, account unlocks, basic troubleshooting',
    3: 'Advanced troubleshooting - complex issues, escalation decisions',
  };

  const prompt = `
You are a training curriculum designer. Generate training scenarios for Level ${currentLevel + 1}.

TRAINEE PROGRESS:
- Current Level: ${currentLevel}
- Total Sessions: ${traineeProgress.total_sessions}
- Average Score: ${traineeProgress.avg_score}
- Level Points: ${traineeProgress.level_points}
- Recent Weaknesses: ${JSON.stringify(traineeProgress.recent_weaknesses)}

NEXT LEVEL DESCRIPTION: ${levelDescriptions[currentLevel + 1] || 'Advanced mastery'}

Generate 3 training scenarios. Return as JSON:
{
  "scenarios": [
    {
      "title": "Scenario name",
      "description": "Detailed scenario description",
      "difficulty": "easy|medium|hard",
      "focus_areas": ["skill 1", "skill 2"],
      "success_criteria": ["criterion 1", "criterion 2"]
    }
  ],
  "levelUpRequirements": ["requirement 1", "requirement 2", "requirement 3"]
}

Scenarios should address weaknesses while building new skills for the next level.
`;

  const aiResponse = await callChutesAI(
    [{ role: 'user', content: prompt }],
    { responseFormat: 'json', maxTokens: 2048, context: 'generateLevelScenarios' }
  );

  if (!aiResponse.success) {
    return {
      success: false,
      scenarios: [],
      levelUpRequirements: [],
      error: aiResponse.error,
    };
  }

  try {
    const result = JSON.parse(aiResponse.data);
    return {
      success: true,
      scenarios: Array.isArray(result.scenarios) ? result.scenarios : [],
      levelUpRequirements: Array.isArray(result.levelUpRequirements) ? result.levelUpRequirements : [],
    };
  } catch {
    return {
      success: false,
      scenarios: [],
      levelUpRequirements: [],
      error: 'Failed to parse scenarios JSON',
    };
  }
}

export { CHUTES_API_KEY, CHUTES_MODEL, CHUTES_API_URL, validateEnvironment, logDebug, logError };
