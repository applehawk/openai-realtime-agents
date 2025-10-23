/**
 * Interview Agent - User personalization agent
 *
 * Conducts initial user interviews to gather preferences.
 * Returns control to Router Agent automatically via exit criteria.
 *
 * Architecture: docs/ARCHITECTURE.md
 */

import { RealtimeAgent } from '@openai/agents/realtime';
import { interviewAgentPrompt } from '../prompts/interviewPrompt';
import { getCurrentUserInfo } from '../userInfoTool';
import {
  startInitialInterview,
  conductInitialInterview,
} from '../interviewTools';

export const interviewAgent = new RealtimeAgent({
  name: 'interviewAgent',

  handoffDescription:
    'Специалист по персонализации: проведение интервью для новых пользователей. ' +
    'Используйте для сбора предпочтений и настройки опыта.',

  instructions: interviewAgentPrompt,

  tools: [
    getCurrentUserInfo,
    startInitialInterview,
    conductInitialInterview,
    // Note: checkInterviewStatus уже вызван Router Agent перед делегацией
  ],
});
