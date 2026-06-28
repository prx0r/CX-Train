import type { GraphState, CallumIntent } from '../state';

function heuristicClassify(message: string): CallumIntent {
  const m = message.toLowerCase();
  if (/\b(open|show|go to|navigate)\b/.test(m)) return 'navigate';
  if (/\b(assign|training|drill|retry|practice|improve)\b/.test(m)) return 'suggest_next_training';
  if (/\b(why|score|failed|fail|low|wrong|explain|cost)\b/.test(m)) return 'explain_assessment';
  return 'general_question';
}

export function classifyIntentNode(state: GraphState): Partial<GraphState> {
  if (!state.message) {
    return { intent: null, errors: [...state.errors, 'No message to classify'] };
  }

  const intent = heuristicClassify(state.message);

  if (intent === 'navigate') {
    const m = state.message.toLowerCase();
    let targetRoute = '/mvp/assessments';
    if (m.includes('standards')) targetRoute = '/mvp/standards';
    else if (m.includes('system')) targetRoute = '/mvp/system';
    else if (m.includes('settings')) targetRoute = '/mvp/settings';
    else if (m.includes('assessment')) targetRoute = '/mvp/assessments';
    else if (m.includes('dashboard') || m.includes('home')) targetRoute = '/mvp';

    return { intent, targetRoute };
  }

  return { intent };
}
