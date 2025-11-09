import { tool } from '@openai/agents/realtime';

/**
 * Tool for getting current user information
 */
export const getCurrentUserInfo = tool({
  name: 'getCurrentUserInfo',
  description: 'Получить информацию о текущем пользователе из сессии',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      // Call the API endpoint to get user info
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return {
          userId: null,
          username: null,
          message: 'Пользователь не аутентифицирован',
        };
      }

      const user = await response.json();
      
      return {
        userId: user.id,
        username: user.username,
        email: user.email,
        position: 'Специалист', // Default position - will be updated during interview
        message: 'Информация о пользователе получена',
      };
    } catch (error: any) {
      console.error('[UserInfo] Error getting user info:', error);
      return {
        userId: null,
        username: null,
        message: `Ошибка получения информации о пользователе: ${error.message}`,
      };
    }
  },
});
