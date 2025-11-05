import { Agent } from '@openai/agents';
import { complexityAssessorInstructions2 } from '../prompts/complexityAssessor2';

/**
 * Enhanced ComplexityAssessorAgent (v2) - Combined delegation + complexity
 * ✅ Uses gpt-4o-mini for cost efficiency (classification task)
 * ✅ Now includes "tooSimple" level for delegating back to primary agent
 * ✅ Replaces both delegationReviewerAgent and original complexityAssessorAgent
 */
export const complexityAssessorAgent2 = new Agent({
  name: 'ComplexityAssessorAgent2',
  model: 'gpt-4o-mini',
  instructions: complexityAssessorInstructions2,
  tools: [], // No tools needed - pure assessment
});

// Log agent initialization
console.log('[complexityAssessorAgent2] Enhanced agent initialized (gpt-4o-mini with delegation support)');
