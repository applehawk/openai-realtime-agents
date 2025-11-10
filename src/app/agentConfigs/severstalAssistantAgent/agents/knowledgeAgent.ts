/**
 * Knowledge Agent - Specialized RAG search agent
 *
 * Handles all knowledge retrieval from documents, notes, and email archives.
 * Returns control to Router Agent automatically via exit criteria.
 *
 * Architecture: docs/ARCHITECTURE.md
 */

import { RealtimeAgent } from '@openai/agents/realtime';
import { knowledgeAgentPrompt } from '../prompts/knowledgePrompt';
import {
  lightragQuery,
  lightragQueryData,
  lightragInsertText,
  lightragSearchLabels,
  lightragCheckEntityExists,
  lightragUpdateEntity,
  lightragUpdateRelation,
  lightragDeleteEntity,
  lightragDeleteRelation
} from '../tools/rag/ragTools';

export const knowledgeAgent = new RealtimeAgent({
  name: 'knowledgeAgent',

  handoffDescription:
    'Специалист по работе с базой знаний: поиск, анализ, управление документами и knowledge graph. ' +
    'Используйте для вопросов о прошлом, исторического контекста, поиска в документах, ' +
    'управления entities и связями в knowledge graph.',

  instructions: knowledgeAgentPrompt,

  tools: [
    // Query tools - основные RAG запросы
    lightragQuery,
    lightragQueryData,
    
    // Document tools - управление документами
    lightragInsertText,
    
    // Graph tools - работа с knowledge graph
    lightragSearchLabels,
    lightragCheckEntityExists,
    lightragUpdateEntity,
    lightragUpdateRelation,
    lightragDeleteEntity,
    lightragDeleteRelation,
  ],
});

// Function to configure bidirectional handoff after routerAgent is created
export function setKnowledgeAgentHandoff(routerAgent: RealtimeAgent) {
  knowledgeAgent.handoffs = [routerAgent];
}
