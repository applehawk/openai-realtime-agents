import { Agent, hostedMcpTool } from '@openai/agents';
import { executorAgentInstructions } from '../prompts';

/**
 * Executor Agent - Executes tasks directly
 * 
 * This agent is called to execute tasks that don't need breakdown,
 * OR to aggregate results after subtasks have been completed.
 */
export const executorAgent = new Agent({
  name: 'ExecutorAgent',
  model: 'gpt-4o',
  instructions: executorAgentInstructions,
  tools: [
    // Calendar MCP for email and calendar operations
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),
  ],
});

// Log agent initialization
console.log('[executorAgent] Agent initialized:', {
  name: executorAgent.name,
  purpose: 'Executes tasks directly or aggregates subtask results',
  toolCount: executorAgent.tools?.length || 0,
});

