/**
 * Router Agent - Main orchestration agent
 *
 * Central control agent that routes requests to specialized agents
 * and handles direct MCP tool calls for simple tasks.
 *
 * Architecture: docs/ARCHITECTURE.md
 */

import { RealtimeAgent } from '@openai/agents/realtime';
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

// MCP Server Manager for initialization
import { mcpServerManager } from '../libs/mcpServerManager';

// MCP servers array that will be populated before agent creation
export const mcpServers: any[] = [];

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage', // Или другой голос по выбору
  instructions: routerAgentPrompt,

  // Handoffs к специализированным RealtimeAgents (автоматический возврат)
  handoffs: [
    knowledgeAgent,    // ← Делегация для RAG поиска
    interviewAgent,    // ← Делегация для персонализации
  ],

  // MCP Servers (будут добавлены через initializeMCPServersBeforeAgent)
  mcpServers,

  // Tools для прямых вызовов и backend делегации
  tools: [
    // User info tools для проверки статуса интервью
    getCurrentUserInfo,
    manageUserInterview, // ← Универсальный инструмент для управления интервью и получения предпочтений
    updateUserPreferences, // ← Обновление предпочтений пользователя

    // Backend agent для всех многошаговых задач
    delegateToIntelligentSupervisor, // ← Unified intelligent supervisor (Path 4)

    // Task context для получения состояния выполняемых задач
    getTaskContext, // ← Получить состояние задачи по sessionId
  ],
});

// Configure bidirectional handoffs (specialized agents can transfer back to router)
setKnowledgeAgentHandoff(routerAgent);
setInterviewAgentHandoff(routerAgent);

/**
 * Initialize MCP servers BEFORE creating the agent
 * This should be called during app initialization, after user authentication
 */
export async function initializeMCPServersBeforeAgent(accessToken?: string): Promise<boolean> {
  try {
    console.log('[routerAgent] Initializing MCP servers before agent creation...');
    const mcpServer = await mcpServerManager.fetchAndInitialize(accessToken);

    if (mcpServer) {
      // Add to the mcpServers array that agent references
      mcpServers.push(mcpServer);
      console.log('[routerAgent] MCP server initialized successfully');
      return true;
    } else {
      console.warn('[routerAgent] Failed to initialize MCP server');
      return false;
    }
  } catch (error) {
    console.error('[routerAgent] Error initializing MCP servers:', error);
    return false;
  }
}

/**
 * Cleanup MCP server connection
 */
export async function cleanupMCPServer(): Promise<void> {
  try {
    await mcpServerManager.cleanup();
    // Clear the mcpServers array
    mcpServers.length = 0;
    console.log('[routerAgent] MCP server cleaned up');
  } catch (error) {
    console.error('[routerAgent] Error cleaning up MCP server:', error);
  }
}

// Export MCP server manager for external access
export { mcpServerManager };

// Export scenario array for compatibility
export const routerScenario = [routerAgent];
export default routerScenario;
