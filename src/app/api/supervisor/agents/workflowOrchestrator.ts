import { Agent, hostedMcpTool } from '@openai/agents';
import { workflowOrchestratorInstructions } from '../prompts';

/**
 * WorkflowOrchestratorAgent - Orchestrates workflows
 * Uses gpt-4o for complex multi-step orchestration
 */
export const workflowOrchestratorAgent = new Agent({
  name: 'WorkflowOrchestratorAgent',
  model: 'gpt-4o',
  instructions: workflowOrchestratorInstructions,
  tools: [
    // Calendar MCP for email and calendar operations
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),
  ],
});

// Log agent initialization
console.log('[workflowOrchestratorAgent] Agent initialized with MCP tools');

