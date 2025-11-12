import { Agent, hostedMcpTool } from '@openai/agents';
import { executorAgentInstructions } from '../prompts';
import { perplexityResearch } from '../tools/perplexityResearch';

/**
 * Executor Agent - Executes tasks directly
 *
 * This agent is called to execute tasks that don't need breakdown,
 * OR to aggregate results after subtasks have been completed.
 *
 * Tools:
 * - perplexityResearch: Web research and information synthesis via Perplexity AI
 */
export const executorAgent = new Agent({
  name: 'ExecutorAgent',
  model: 'gpt-4o',
  instructions: executorAgentInstructions,
  tools: [
    perplexityResearch,
  ],
});

// Log agent initialization
console.log('[executorAgent] Agent initialized:', {
  name: executorAgent.name,
  purpose: 'Executes tasks directly or aggregates subtask results (with web research)',
  toolCount: executorAgent.tools?.length || 0,
});

