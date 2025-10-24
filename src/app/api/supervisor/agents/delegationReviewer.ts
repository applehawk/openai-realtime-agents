import { Agent } from '@openai/agents';
import { delegationReviewerInstructions } from '../prompts';

/**
 * DelegationReviewerAgent - Decides delegation
 * ✅ Uses gpt-4o-mini for cost efficiency (binary decision task)
 */
export const delegationReviewerAgent = new Agent({
  name: 'DelegationReviewerAgent',
  model: 'gpt-4o-mini',
  instructions: delegationReviewerInstructions,
  tools: [], // No tools needed - pure decision-making
});

// Log agent initialization
console.log('[delegationReviewerAgent] Agent initialized (gpt-4o-mini for cost savings)');

