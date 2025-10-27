/**
 * Central export point for all agent prompts
 */

export { decisionAgentInstructions } from './decision';
export { executorAgentInstructions } from './executor';
export { complexityAssessorInstructions } from './complexityAssessor';
export { complexityAssessorInstructions2 } from './complexityAssessor2'; // v3.2: Enhanced with delegation
export { taskPlannerInstructions } from './taskPlanner';
export { workflowOrchestratorInstructions } from './workflowOrchestrator';
export { reportGeneratorInstructions } from './reportGenerator';

