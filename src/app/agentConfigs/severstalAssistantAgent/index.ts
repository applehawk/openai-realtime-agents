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
import { routerAgent, routerScenario } from './agents/routerAgent';

// Export the Router Agent as main agent
export const severstalAssistant = routerAgent;

// Export scenario for use in App
export const chatSeverstalAssistantScenario = routerScenario;

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
