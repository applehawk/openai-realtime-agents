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
});

// Log agent initialization
console.log('[workflowOrchestratorAgent] Agent initialized with MCP tools');

