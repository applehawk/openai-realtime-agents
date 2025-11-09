import { RealtimeAgent } from '@openai/agents/realtime';
import { projectAgentPrompt } from '../prompts/projectPrompt';
import {
  getProjectByName,
  createProject,
  updateProject,
  updateProjectField,
  deleteProject,
  searchProjects,
  getAllProjects,
} from '../tools/projectTools';
import { projectWizard } from '../tools/projects/projectWizardTools';

export const projectAgent = new RealtimeAgent({
  name: 'projectAgent',
  handoffDescription: 'Агент для управления проектами: создание, обновление статуса, получение информации',
  instructions: projectAgentPrompt,
  tools: [
    // Пошаговые сценарии (мастер)
    projectWizard,

    // Базовые операции MCP
    getProjectByName,
    createProject,
    updateProject,
    updateProjectField,
    deleteProject,
    searchProjects,
    getAllProjects,
  ],
  voice: 'alloy',
});

export function setProjectAgentHandoff(routerAgent: RealtimeAgent) {
  projectAgent.handoffs = [routerAgent];
}


