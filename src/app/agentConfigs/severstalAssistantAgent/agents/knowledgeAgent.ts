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
  lightragQueryData
} from '../ragTools';

export const knowledgeAgent = new RealtimeAgent({
  name: 'knowledgeAgent',

  handoffDescription:
    'Специалист по поиску информации в базе знаний, документах, истории. ' +
    'Используйте для вопросов о прошлом, исторического контекста, поиска в документах и заметках.',

  instructions: knowledgeAgentPrompt,

  tools: [
    lightragQuery,
    lightragQueryData,
  ],
});
