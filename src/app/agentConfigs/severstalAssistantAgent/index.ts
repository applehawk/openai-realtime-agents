import { RealtimeAgent } from '@openai/agents/realtime';
import { hostedMcpTool } from '@openai/agents';
import { delegateToSupervisor } from './supervisorAgent';
import { executeComplexTask } from './executeComplexTaskTool';
import { lightragQuery, lightragQueryData } from './ragTools';
import { improvedRussianAssistantPrompt } from './improvedPrompt';
import { conductInitialInterview, checkInterviewStatus, startInitialInterview } from './interviewTools';

// Re-export the heuristic function for testing and external use
export { shouldDelegateToSupervisor } from './supervisorAgent';

// For rollback capability, the old prompt is available in russianAssistantPrompt_v1.ts
// import { russianAssistantPrompt_v1 } from './russianAssistantPrompt_v1';

export const severstalAssistant = new RealtimeAgent({
  name: 'severstalAssistant',
  voice: 'sage',
  instructions: improvedRussianAssistantPrompt, // Using improved v2.0 prompt
    tools: [
        // Primary MCP tools for direct email/calendar operations
        hostedMcpTool({
            serverLabel: 'calendar',
            serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
        }),
        // LightRAG tools for knowledge retrieval (custom implementation for JSON-RPC)
        lightragQuery,
        lightragQueryData,
        // Interview tools for user personalization
        startInitialInterview,
        conductInitialInterview,
        checkInterviewStatus,
        // Supervisor delegation tool for complex multi-step tasks (5-7 steps)
        delegateToSupervisor,
        // Hierarchical task execution for VERY complex tasks (8+ steps)
        executeComplexTask,
    ],
  });

// Verification: Log tool configuration
console.log('[severstalAssistant] Agent initialized with tools:', {
  toolCount: severstalAssistant.tools.length,
  toolNames: severstalAssistant.tools.map((t: any) => t.name || t.definition?.name || 'unnamed'),
  toolTypes: severstalAssistant.tools.map((t: any) => t.constructor?.name || typeof t),
});

// Detailed tool inspection
severstalAssistant.tools.forEach((t: any, idx: number) => {
  console.log(`[severstalAssistant] Tool ${idx + 1}:`, {
    name: t.name || t.definition?.name,
    type: t.constructor?.name,
    description: (t.description || t.definition?.description || '').substring(0, 100),
  });
});

export const chatSeverstalAssistantScenario = [severstalAssistant];
export default chatSeverstalAssistantScenario;