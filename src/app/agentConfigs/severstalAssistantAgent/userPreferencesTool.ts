import { tool } from '@openai/agents/realtime';

/**
 * Tool for querying user preferences from their personal workspace
 */
export const queryUserPreferences = tool({
  name: 'queryUserPreferences',
  description: 'Запросить предпочтения пользователя из его персонального workspace',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      query: {
        type: 'string',
        description: 'Запрос о предпочтениях пользователя',
      },
    },
    required: ['userId', 'query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, query } = input;
    
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      // Call RAG API directly with user's workspace
      const response = await fetch('http://79.132.139.57:9621/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          mode: 'local',
          top_k: 3,
          workspace: workspaceName,
        }),
      });

      if (!response.ok) {
        throw new Error(`RAG API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        response: data.response || 'Данные не найдены',
        references: data.references || [],
        workspace: workspaceName,
      };
    } catch (error: any) {
      console.error('[UserPreferences] Error querying preferences:', error);
      return {
        success: false,
        response: `Ошибка при запросе предпочтений: ${error.message}`,
        references: [],
        workspace: `${userId}_user_key_preferences`,
      };
    }
  },
});
