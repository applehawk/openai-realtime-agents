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
import type { Tool } from '@openai/agents';
import { routerAgentPrompt } from '../prompts/routerPrompt';

// Specialized agents for handoffs
import { knowledgeAgent, setKnowledgeAgentHandoff } from './knowledgeAgent';
import { interviewAgent, setInterviewAgentHandoff } from './interviewAgent';
import { projectAgent, setProjectAgentHandoff } from './projectAgent';

// Tools for direct execution and delegation
import { delegateToIntelligentSupervisor } from '../tools/intelligentSupervisorTool'; // Unified supervisor
// import { getCurrentUserInfo } from '../tools/interview/userInfoTool'; // DISABLED - see tools array
import { updateUserPreferences, queryUserPreferences } from '../tools/rag/userPreferencesTool';
import { manageUserInterview } from '../tools/interview/interviewTools';

// MCP Server Manager for initialization
import { mcpServerManager } from '../libs/mcpServerManager';
import { getCurrentUserInfo } from '../tools/interview/userInfoTool';
import { updateUserPreferencesTool, detectPreferenceUpdateRequest } from '../tools/preferences/updatePreferencesTool';

/**
 * Create router agent with optional MCP tools
 * This function allows creating a fresh agent instance with hostedMcpTool
 */
function createRouterAgent(mcpUrl?: string): RealtimeAgent {
  // Base tools that are always available
  const baseTools: Tool[] = [
    // User info tools для проверки статуса интервью
    getCurrentUserInfo,
    manageUserInterview, // ← Универсальный инструмент для управления интервью и получения предпочтений
    queryUserPreferences, // ← Запрос предпочтений пользователя
    updateUserPreferences, // ← Обновление предпочтений пользователя

    // Новые инструменты для обновления предпочтений через естественную речь
    detectPreferenceUpdateRequest, // ← Анализ запроса на изменение предпочтений
    updateUserPreferencesTool, // ← Обновление предпочтений по категориям

    // Backend agent для всех многошаговых задач
    delegateToIntelligentSupervisor, // ← Unified intelligent supervisor (Path 4)
  ];

  // Add hostedMcpTool if MCP URL is provided
  const tools: Tool[] = mcpUrl
    ? [
        ...baseTools,
        // hostedMcpTool({
        //   serverLabel: 'google',
        //   serverUrl: mcpUrl,
        // }),
      ]
    : baseTools;

  const agent = new RealtimeAgent({
    name: 'routerAgent',
    voice: 'sage', // Или другой голос по выбору
    instructions: routerAgentPrompt,

    // Handoffs к специализированным RealtimeAgents (автоматический возврат)
    handoffs: [
      knowledgeAgent,    // ← Делегация для RAG поиска
      interviewAgent,    // ← Делегация для персонализации
      projectAgent,      // ← Делегация для управления проектами
    ],

    // Tools для прямых вызовов, backend делегации и MCP
    tools,
  });

  // Configure bidirectional handoffs (specialized agents can transfer back to router)
  setKnowledgeAgentHandoff(agent);
  setInterviewAgentHandoff(agent);
  setProjectAgentHandoff(agent);

  return agent;
}

// Create initial router agent without MCP tools
// This will be replaced after MCP URL is obtained and hostedMcpTool is added
export let routerAgent = createRouterAgent();

// Store for the current agent instance
let currentRouterAgent = routerAgent;

/**
 * Initialize MCP servers and recreate agent with hostedMcpTool
 * This should be called during app initialization, after user authentication
 *
 * IMPORTANT: Using hostedMcpTool approach:
 * 1. Fetch container status and MCP tools list from server
 * 2. Get MCP URL from mcpServerManager
 * 3. Pass URL to hostedMcpTool in Agent constructor
 *
 * This prevents "No existing trace found" error in browser environment
 */
export async function initializeMCPServersBeforeAgent(accessToken?: string): Promise<RealtimeAgent | null> {
  try {
    console.log('[routerAgent] 🔄 Initializing MCP servers and recreating agent...');

    // Check if MCP URL is already set to prevent duplicates
    const existingMcpUrl = mcpServerManager.getMcpUrl();
    if (existingMcpUrl) {
      console.log('[routerAgent] ✅ MCP server already initialized, returning current agent');
      return currentRouterAgent;
    }

    // Step 1: Fetch container status and initialize MCP server manager
    const mcpTools = await mcpServerManager.fetchAndInitialize(accessToken);

    if (!mcpTools || mcpTools.length === 0) {
      console.warn('[routerAgent] ⚠️ Failed to initialize MCP server (no tools returned, container may not be ready)');
      return null;
    }

    // Step 2: Get MCP URL from manager
    const mcpUrl = mcpServerManager.getMcpUrl();

    if (!mcpUrl) {
      console.error('[routerAgent] ❌ MCP URL is not available after initialization!');
      return null;
    }

    console.log('[routerAgent] ✅ MCP server initialized with URL:', mcpUrl);
    console.log('[routerAgent] ✅ Found', mcpTools.length, 'MCP tools');

    // Step 3: Recreate agent with hostedMcpTool
    console.log('[routerAgent] 🔧 Recreating router agent with hostedMcpTool...');
    currentRouterAgent = createRouterAgent(/*mcpUrl*/);
    routerAgent = currentRouterAgent; // Update exported reference

    console.log('[routerAgent] ✅ Router agent recreated with hostedMcpTool:', {
      mcpUrl,
      toolCount: mcpTools.length,
      toolNames: mcpTools.map(t => t.name),
      agentName: currentRouterAgent.name,
    });

    console.log('[routerAgent] ✅ Router agent ready for RealtimeSession');

    return currentRouterAgent;
  } catch (error) {
    console.error('[routerAgent] ❌ Critical error initializing MCP servers:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Cleanup MCP server connection and recreate agent without hostedMcpTool
 */
export async function cleanupMCPServer(): Promise<void> {
  try {
    console.log('[routerAgent] 🧹 Cleaning up MCP server...');
    await mcpServerManager.cleanup();

    // Recreate agent without hostedMcpTool
    console.log('[routerAgent] 🔧 Recreating router agent without hostedMcpTool...');
    currentRouterAgent = createRouterAgent();
    routerAgent = currentRouterAgent; // Update exported reference

    console.log('[routerAgent] ✅ MCP server cleaned up, agent recreated without hostedMcpTool');
  } catch (error) {
    console.error('[routerAgent] ❌ Error cleaning up MCP server:', error);
  }
}

/**
 * Get current router agent instance
 * Use this to get the latest agent with or without hostedMcpTool
 */
export function getCurrentRouterAgent(): RealtimeAgent {
  return currentRouterAgent;
}

// Export MCP server manager for external access
export { mcpServerManager };

// Export scenario array for compatibility
export const routerScenario = [routerAgent];
export default routerScenario;
