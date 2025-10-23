/**
 * Router Agent - Main orchestration agent
 *
 * Central control agent that routes requests to specialized agents
 * and handles direct MCP tool calls for simple tasks.
 *
 * Architecture: docs/ARCHITECTURE.md
 */

import { RealtimeAgent } from '@openai/agents/realtime';
import { hostedMcpTool } from '@openai/agents';
import { routerAgentPrompt } from '../prompts/routerPrompt';

// Specialized agents for handoffs
import { knowledgeAgent } from './knowledgeAgent';
import { interviewAgent } from './interviewAgent';

// Tools for direct execution and delegation
import { delegateToSupervisor } from '../supervisorAgent';
import { executeComplexTask } from '../executeComplexTaskTool';
import { checkInterviewStatus } from '../interviewTools';
import { getCurrentUserInfo } from '../userInfoTool';

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage', // Или другой голос по выбору
  instructions: routerAgentPrompt,

  // Handoffs к специализированным RealtimeAgents (автоматический возврат)
  handoffs: [
    knowledgeAgent,    // ← Делегация для RAG поиска
    interviewAgent,    // ← Делегация для персонализации
  ],

  // Tools для прямых вызовов и backend делегации
  tools: [
    // MCP Server (внешний сервис для email/calendar, возврат через response)
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),

    // User info tools для проверки статуса интервью
    getCurrentUserInfo,
    checkInterviewStatus,

    // Backend agents (возврат через response от fetch)
    delegateToSupervisor,      // ← Tool call, возврат через response (Planning Agent)
    executeComplexTask,        // ← Tool call, возврат через response (Complex Task Agent)
  ],
});

// Export scenario array for compatibility
export const routerScenario = [routerAgent];
export default routerScenario;
