/**
 * SeverstalAssistant Agent Configuration
 *
 * Multi-agent architecture (v3.0)
 * - Router Agent: Main orchestration agent
 * - Knowledge Agent: RAG search specialist
 * - Interview Agent: User personalization specialist
 *
 * Architecture: docs/ARCHITECTURE.md
 * Previous versions available in legacy/ folder for rollback
 */

// Import new multi-agent architecture
import {
  routerAgent,
  routerScenario,
  initializeMCPServersBeforeAgent,
  cleanupMCPServer,
  mcpServerManager,
  getCurrentRouterAgent,
} from './agents/routerAgent';

// MCP Server should be initialized BEFORE creating RealtimeSession
// Call initializeMCPServersBeforeAgent() after user authentication, before using the agent
// This will recreate the agent with connected MCP servers

// Export the Router Agent as main agent (initial instance without MCP)
export const severstalAssistant = routerAgent;

// Export function to get current agent (may have MCP servers after initialization)
export { getCurrentRouterAgent };

// Export scenario for use in App
// Note: This will contain the initial agent, but App should use getCurrentRouterAgent()
// after MCP initialization
export const chatSeverstalAssistantScenario = routerScenario;

// Export MCP server management functions
export { initializeMCPServersBeforeAgent, cleanupMCPServer, mcpServerManager };

// Default export
export default chatSeverstalAssistantScenario;

// Verification: Log configuration
console.log('[severstalAssistant] Multi-agent architecture initialized');
console.log('[severstalAssistant] Router Agent:', {
  name: routerAgent.name,
  handoffCount: routerAgent.handoffs?.length || 0,
  handoffNames: routerAgent.handoffs?.map((a: any) => a.name) || [],
  toolCount: routerAgent.tools?.length || 0,
  toolNames: routerAgent.tools?.map((t: any) => t.name || t.definition?.name || 'unnamed') || [],
});

// Log handoff agents
if (routerAgent.handoffs && routerAgent.handoffs.length > 0) {
  console.log('[severstalAssistant] Handoff agents configured:');
  routerAgent.handoffs.forEach((agent: any, idx: number) => {
    console.log(`  ${idx + 1}. ${agent.name}:`, agent.handoffDescription);
  });
}

// Log tools
if (routerAgent.tools && routerAgent.tools.length > 0) {
  console.log('[severstalAssistant] Tools configured:');
  routerAgent.tools.forEach((tool: any, idx: number) => {
    const name = tool.name || tool.definition?.name || 'unnamed';
    const desc = (tool.description || tool.definition?.description || '').substring(0, 80);
    console.log(`  ${idx + 1}. ${name}: ${desc}`);
  });
}

// Log MCP servers status
console.log('[severstalAssistant] MCP Servers:', {
  count: routerAgent.mcpServers?.length || 0,
  status: 'Will be initialized after user authentication',
  initFunction: 'initializeMCPServersBeforeAgent()',
});
