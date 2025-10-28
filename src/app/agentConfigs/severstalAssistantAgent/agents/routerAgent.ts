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
import { knowledgeAgent, setKnowledgeAgentHandoff } from './knowledgeAgent';
import { interviewAgent, setInterviewAgentHandoff } from './interviewAgent';

// Tools for direct execution and delegation
import { delegateToIntelligentSupervisor } from '../tools/intelligentSupervisorTool'; // Unified supervisor
import { getTaskContext } from '../tools/getTaskContextTool';
import { getCurrentUserInfo } from '../tools/interview/userInfoTool';
import { updateUserPreferences } from '../tools/rag/userPreferencesTool';
import { manageUserInterview } from '../tools/interview/interviewTools';
import { updateUserPreferencesTool, detectPreferenceUpdateRequest } from '../tools/preferences/updatePreferencesTool';

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
    manageUserInterview, // ← Универсальный инструмент для управления интервью и получения предпочтений
    updateUserPreferences, // ← Обновление предпочтений пользователя (старый способ)
    
    // Новые инструменты для обновления предпочтений через естественную речь
    detectPreferenceUpdateRequest, // ← Анализ запроса на изменение предпочтений
    updateUserPreferencesTool, // ← Обновление предпочтений по категориям

    // Backend agent для всех многошаговых задач
    delegateToIntelligentSupervisor, // ← Unified intelligent supervisor (Path 4)
    
    // Task context для получения состояния выполняемых задач
    getTaskContext, // ← Получить состояние задачи по sessionId
  ],
});

// Configure bidirectional handoffs (specialized agents can transfer back to router)
setKnowledgeAgentHandoff(routerAgent);
setInterviewAgentHandoff(routerAgent);

// Export scenario array for compatibility
export const routerScenario = [routerAgent];
export default routerScenario;
