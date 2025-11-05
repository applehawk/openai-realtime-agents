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
import { getCurrentUserInfo } from '../tools/interview/userInfoTool';
import {
  manageUserInterview,
  conductInitialInterview,
  validateInterviewAnswer,
} from '../tools/interview/interviewTools';

export const interviewAgent = new RealtimeAgent({
  name: 'interviewAgent',

  handoffDescription:
    'Специалист по персонализации: проведение интервью для новых пользователей. ' +
    'Используйте для сбора предпочтений и настройки опыта.',

  instructions: interviewAgentPrompt,

  tools: [
    getCurrentUserInfo,
    manageUserInterview, // ← Универсальный инструмент для управления интервью и получения предпочтений
    conductInitialInterview,
    validateInterviewAnswer, // ← Валидация качества ответов пользователя
    // Note: checkInterviewStatus уже вызван Router Agent перед делегацией
  ],
});

// Function to configure bidirectional handoff after routerAgent is created
export function setInterviewAgentHandoff(routerAgent: RealtimeAgent) {
  interviewAgent.handoffs = [routerAgent];
}
