import { tool } from '@openai/agents/realtime';

/**
 * Tool for getting current user information from session context
 *
 * NOTE: User info is pre-fetched and included in the session context during connection.
 * This tool simply returns the user info from context, avoiding async fetch issues
 * with cookies and authentication in the Realtime API environment.
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
  execute: async (input: any, context: any) => {
    console.log('[getCurrentUserInfo] Tool execution started');
    console.log('[getCurrentUserInfo] Context available:', !!context);

    try {
      // Get user info from session context (pre-fetched during connection)
      const currentUser = context?.currentUser;

      if (!currentUser) {
        console.warn('[getCurrentUserInfo] No user info in context');
        return {
          userId: null,
          username: null,
          email: null,
          message: 'Информация о пользователе недоступна',
        };
      }

      const result = {
        userId: currentUser.userId,
        username: currentUser.username,
        email: currentUser.email,
        googleConnected: currentUser.googleConnected,
        googleServices: currentUser.googleServices,
        position: 'Специалист', // Default position - will be updated during interview
        message: 'Информация о пользователе получена из контекста сессии',
      };

      console.log('[getCurrentUserInfo] Returning result from context:', result);
      return result;
    } catch (error: any) {
      console.error('[getCurrentUserInfo] Error getting user info:', error);
      return {
        userId: null,
        username: null,
        email: null,
        message: `Ошибка получения информации о пользователе: ${error.message}`,
      };
    }
  },
});
