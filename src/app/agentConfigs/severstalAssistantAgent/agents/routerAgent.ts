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
// import { getCurrentUserInfo } from '../tools/interview/userInfoTool'; // DISABLED - see tools array
import { updateUserPreferences } from '../tools/rag/userPreferencesTool';
import { manageUserInterview } from '../tools/interview/interviewTools';

// MCP Server Manager for initialization
import { mcpServerManager } from '../libs/mcpServerManager';

// export const mcpServer = new MCPServerStreamableHttp({
//   url: 'http://mcpgoogle-mr.vasilenko.vlad1:8000/mcp',
//   name: 'Google Services (Gmail / Calendar)',
// });

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage', // Или другой голос по выбору
  instructions: routerAgentPrompt,

  // Handoffs к специализированным RealtimeAgents (автоматический возврат)
  handoffs: [
    knowledgeAgent,    // ← Делегация для RAG поиска
    interviewAgent,    // ← Делегация для персонализации
  ],

  mcpServers: [],

  // Tools для прямых вызовов и backend делегации
  tools: [
    // NOTE: getCurrentUserInfo removed - user info is passed in initial message context
    // getCurrentUserInfo, // <-- DISABLED: tools execute on OpenAI server, can't access browser cookies

    // User info tools для проверки статуса интервью
    manageUserInterview, // ← Универсальный инструмент для управления интервью и получения предпочтений
    updateUserPreferences, // ← Обновление предпочтений пользователя

    // Backend agent для всех многошаговых задач
    delegateToIntelligentSupervisor, // ← Unified intelligent supervisor (Path 4)

    // Task context для получения состояния выполняемых задач
    getTaskContext, // ← Получить состояние задачи по sessionId
    // Note: MCP tools are loaded dynamically via initializeMCPServersBeforeAgent()
    // This hostedMcpTool is commented out to avoid conflicts
    // hostedMcpTool({
    //   serverLabel: 'mcp',
    //   serverUrl: 'http://mcpgoogle-mr.vasilenko.vlad:8000/mcp',
    //   requireApproval: 'never'
    // }),
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
    console.log('[routerAgent] Current MCP servers count:', routerAgent.mcpServers.length);

    // Check if MCP server is already initialized to prevent duplicates
    if (routerAgent.mcpServers.length > 0) {
      console.log('[routerAgent] MCP server already initialized, skipping re-initialization');
      return true;
    }

    const mcpServer = await mcpServerManager.fetchAndInitialize(accessToken);

    if (mcpServer) {
      // Add to the mcpServers array that agent references
      routerAgent.mcpServers = [mcpServer];
      console.log('[routerAgent] MCP server initialized successfully, total count:', routerAgent.mcpServers.length);

      // Verify connection status
      const isConnected = mcpServerManager.isServerConnected();
      console.log('[routerAgent] MCP server connection verified:', isConnected);

      if (!isConnected) {
        console.error('[routerAgent] MCP server instance created but not connected!');
        return false;
      }

      // Note: listTools() is not available on client-side MCPServerStreamableHttp
      // The MCP server URL is passed to OpenAI Realtime API which calls tools directly
      // To list tools for diagnostics, use /api/mcp/tools server endpoint
      console.log('[routerAgent] ✅ MCP server ready for OpenAI Realtime API');

      return true;
    } else {
      console.warn('[routerAgent] Failed to initialize MCP server (null returned, container may not be ready)');
      return false;
    }
  } catch (error) {
    console.error('[routerAgent] Critical error initializing MCP servers:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Cleanup MCP server connection
 */
export async function cleanupMCPServer(): Promise<void> {
  try {
    console.log('[routerAgent] Cleaning up MCP server, current count:', routerAgent.mcpServers.length);
    await mcpServerManager.cleanup();
    // Clear the mcpServers array
    routerAgent.mcpServers.length = 0;
    routerAgent.mcpServers = []

    console.log('[routerAgent] MCP server cleaned up, servers cleared');
  } catch (error) {
    console.error('[routerAgent] Error cleaning up MCP server:', error);
  }
}

// Export MCP server manager for external access
export { mcpServerManager };

// Export scenario array for compatibility
export const routerScenario = routerAgent;
export default routerScenario;
