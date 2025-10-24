import { Agent } from '@openai/agents';
import { decisionAgentInstructions } from '../prompts';

/**
 * Decision Agent - Decides if task needs breakdown
 * 
 * This agent is called BEFORE execution to determine if decomposition is needed.
 * It should say "NO" most of the time to avoid unnecessary breakdown.
 */
export const decisionAgent = new Agent({
  name: 'DecisionAgent',
  model: 'gpt-4o-mini',
  instructions: decisionAgentInstructions,
  tools: [], // No tools needed - pure decision-making
});

// Log agent initialization
console.log('[decisionAgent] Agent initialized:', {
  name: decisionAgent.name,
  purpose: 'Decides if task needs breakdown (should say NO most of the time)',
});

