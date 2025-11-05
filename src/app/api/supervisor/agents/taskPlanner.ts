import { Agent } from '@openai/agents';
import { taskPlannerInstructions } from '../prompts';

/**
 * TaskPlannerAgent - Generates execution plans
 * Uses gpt-4o for quality-critical planning
 */
export const taskPlannerAgent = new Agent({
  name: 'TaskPlannerAgent',
  model: 'gpt-4o',
  instructions: taskPlannerInstructions,
  tools: [], // No tools needed - planning only
});

// Log agent initialization
console.log('[taskPlannerAgent] Agent initialized (PLAN FIRST mode)');

