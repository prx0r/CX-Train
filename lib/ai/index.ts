/**
 * AI Module Index
 * Central exports for all AI-related functionality
 */

// OpenRouter AI provider (primary MVP path)
export { runAiTask, parseJsonResponse } from './provider';

// Chutes AI integration (legacy, not used in OpenRouter MVP)
export {
  callChutesAI,
  analyzeTrainingPatterns,
  generateSessionFeedback,
  analyzePromptEffectiveness,
  generateLevelScenarios,
  CHUTES_API_KEY,
  CHUTES_MODEL,
  CHUTES_API_URL,
} from './chutes';

// Feedback analysis
export {
  analyzeUserProgress,
  checkLevelProgression,
  promoteUserLevel,
  runAggregateAnalysis,
  generateTrainingPlan,
  LEVEL_REQUIREMENTS,
  type FeedbackAnalysis,
  type LevelProgression,
} from './feedback-analyzer';

// AI Monitor
export {
  runAIMonitor,
  detectPromptIssues,
  generateAdminSummary,
  scheduleRegularMonitoring,
  type MonitorRun,
} from './monitor';
