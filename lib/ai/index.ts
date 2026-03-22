/**
 * AI Module Index
 * Central exports for all AI-related functionality
 */

// Chutes AI integration
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
