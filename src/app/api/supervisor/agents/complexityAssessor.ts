import { Agent } from '@openai/agents';
import { complexityAssessorInstructions } from '../prompts';

/**
 * ComplexityAssessorAgent - Assesses task complexity
 * ✅ Uses gpt-4o-mini for 94% cost savings (simple classification task, high volume)
 */
export const complexityAssessorAgent = new Agent({
  name: 'ComplexityAssessorAgent',
  model: 'gpt-4o-mini',
  instructions: complexityAssessorInstructions,
  tools: [], // No tools needed - pure assessment
});

// Log agent initialization
console.log('[complexityAssessorAgent] Agent initialized (gpt-4o-mini for cost savings)');

