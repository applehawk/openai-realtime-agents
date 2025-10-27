/**
 * DEPRECATED: This file is kept for backward compatibility only.
 * 
 * NEW STRUCTURE (v3.0):
 * - Prompts: src/app/api/supervisor/prompts/
 * - Agents: src/app/api/supervisor/agents/
 * - Types: src/app/api/supervisor/types.ts
 * 
 * Please import from the new locations:
 * 
 * import { decisionAgent, executorAgent, ... } from './agents';
 * import { decisionAgentInstructions, ... } from './prompts';
 * import { SupervisorDecision, SupervisorRequest, ... } from './types';
 */

// Re-export types
export type { SupervisorDecision, SupervisorRequest, SupervisorResponse } from './types';

// Re-export prompts
export {
  decisionAgentInstructions,
  executorAgentInstructions,
  complexityAssessorInstructions,
  taskPlannerInstructions,
  workflowOrchestratorInstructions,
  reportGeneratorInstructions,
} from './prompts';

// Re-export agents
export {
  decisionAgent,
  executorAgent,
  complexityAssessorAgent,
  complexityAssessorAgent2, // v3.2: Enhanced with delegation
  taskPlannerAgent,
  workflowOrchestratorAgent,
  reportGeneratorAgent,
} from './agents';

console.log('[agent.ts] ⚠️  DEPRECATED: Please import directly from ./agents/ and ./prompts/');
