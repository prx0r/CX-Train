import { StateGraph } from './graph';
import type { GraphState } from './state';
import { validateContextNode } from './nodes/validateContext';
import { loadProfileNode } from './nodes/loadProfile';
import { loadThreadNode } from './nodes/loadThread';
import { classifyIntentNode } from './nodes/classifyIntent';
import { loadAssessmentContextNode } from './nodes/loadAssessmentContext';
import { invokeCapabilityNode } from './nodes/invokeCapability';
import { produceResponseNode } from './nodes/produceResponse';
import { persistThreadNode } from './nodes/persistThread';

export function buildCallumGraph() {
  const graph = new StateGraph<GraphState>();

  graph.addNode('validateContext', validateContextNode);
  graph.addNode('loadProfile', loadProfileNode);
  graph.addNode('loadThread', loadThreadNode);
  graph.addNode('classifyIntent', classifyIntentNode);
  graph.addNode('loadAssessmentContext', loadAssessmentContextNode);
  graph.addNode('invokeCapability', invokeCapabilityNode);
  graph.addNode('produceResponse', produceResponseNode);
  graph.addNode('persistThread', persistThreadNode);

  graph.setEntryPoint('validateContext');

  graph.addEdge('validateContext', 'loadProfile');
  graph.addEdge('loadProfile', 'loadThread');
  graph.addEdge('loadThread', 'classifyIntent');
  graph.addEdge('classifyIntent', 'loadAssessmentContext');
  graph.addEdge('loadAssessmentContext', 'invokeCapability');
  graph.addEdge('invokeCapability', 'produceResponse');
  graph.addEdge('produceResponse', 'persistThread');

  graph.setFinishPoint('persistThread');

  return graph.compile();
}
