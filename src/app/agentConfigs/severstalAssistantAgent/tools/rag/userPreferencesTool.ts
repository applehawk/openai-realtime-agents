import { tool } from '@openai/agents/realtime';
import { callRagApiDirect } from '@/app/lib/ragApiClient';

// Use API proxy endpoint for client-side execution
const RAG_API_PROXY = '/api/rag';

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy
 */
async function callRagServerForPreferences(query: string, workspace: string) {
  try {
    console.log(`[UserPreferences] Querying workspace: ${workspace}`);
    console.log(`[UserPreferences] Query: ${query}`);

    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'lightrag_query',
        arguments: {
          query,
          mode: 'local',
          top_k: 3,
          workspace,
          include_references: true,
        },
      },
    };

    console.log(`[UserPreferences] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`RAG server returned status ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`[UserPreferences] Response received:`, {
      hasResult: !!data.result,
      hasError: !!data.error,
      contentLength: data.result?.content?.[0]?.text?.length,
    });

    if (data.error) {
      console.error(`[UserPreferences] RAG server error:`, data.error);
      throw new Error(`RAG server error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Extract text content from MCP response format
    if (data.result?.content?.[0]?.text) {
      const result = data.result.content[0].text;
      console.log(`[UserPreferences] Extracted text (first 200 chars):`, result.substring(0, 200));
      return result;
    }

    const fallbackResult = JSON.stringify(data.result || data);
    console.log(`[UserPreferences] Fallback result:`, fallbackResult.substring(0, 200));
    return fallbackResult;
  } catch (error: any) {
    console.error(`[UserPreferences] Error:`, error);
    throw new Error(`Ошибка подключения к базе знаний: ${error.message}`);
  }
}

/**
 * Helper function to update user preferences in RAG
 */
async function updatePreferencesInRag(userId: string, category: string, newValue: string, workspaceName: string) {
  try {
    const preferenceText = `
ОБНОВЛЕНИЕ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ: ${userId}
Дата обновления: ${new Date().toISOString()}
Категория: ${category}

${category.toUpperCase()}:
${newValue}
    `.trim();
    
    // Use callRagApiDirect for server-side execution (same as interviewTools)
    await callRagApiDirect('/documents/text', 'POST', {
      text: preferenceText,
      file_source: `preference_update_${category}`,
      workspace: workspaceName,
    });

    console.log(`[UserPreferences] Updated ${category} for user ${userId}`);
    return true;
  } catch (error: any) {
    console.error(`[UserPreferences] Error updating:`, error);
    
    // Check if it's a connectivity issue (graceful degradation like in interviewTools)
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[UserPreferences] RAG server appears to be down. Preferences will not be saved.`);
      console.error(`[UserPreferences] Please check if RAG server is running on port 9621`);
      // Don't throw error - allow operation to continue
      return false;
    }
    
    throw new Error(`Ошибка обновления предпочтений: ${error.message}`);
  }
}

/**
 * Tool for querying user preferences from their personal workspace
 */
export const queryUserPreferences = tool({
  name: 'queryUserPreferences',
  description: `Запросить предпочтения и профиль пользователя из его персонального workspace.
  
Используйте этот инструмент для получения информации о:
- Стиле коммуникации пользователя
- Предпочитаемом времени для встреч
- Ключевых компетенциях и областях экспертизы
- Карьерных целях
- Рабочем стиле и подходе к задачам
- Времени для фокусной работы

Эта информация помогает персонализировать ответы и учитывать предпочтения пользователя.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      query: {
        type: 'string',
        description: 'Конкретный запрос о предпочтениях. Примеры: "стиль коммуникации", "предпочтения по встречам", "компетенции", "все предпочтения"',
      },
    },
    required: ['userId', 'query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, query } = input;
    
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      const result = await callRagServerForPreferences(query, workspaceName);
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(result);
        if (parsed.response) {
          return {
            success: true,
            response: parsed.response,
            workspace: workspaceName,
          };
        }
      } catch {
        // Not JSON, return as is
      }
      
      return {
        success: true,
        response: result || 'Данные не найдены',
        workspace: workspaceName,
      };
    } catch (error: any) {
      console.error('[UserPreferences] Error querying preferences:', error);
      return {
        success: false,
        response: `Ошибка при запросе предпочтений: ${error.message}`,
        workspace: `${userId}_user_key_preferences`,
      };
    }
  },
});


/**
 * Tool for updating user preferences
 */
export const updateUserPreferences = tool({
  name: 'updateUserPreferences',
  description: `Обновить предпочтения пользователя в его персональном workspace.
  
Используйте этот инструмент когда пользователь хочет изменить свои предпочтения:
- Изменить стиль коммуникации
- Изменить предпочитаемое время для встреч
- Обновить компетенции или области экспертизы
- Изменить карьерные цели
- Обновить рабочий стиль
- Изменить время для фокусной работы

Примеры запросов пользователя:
- "Теперь я предпочитаю формальный стиль общения"
- "Измени мое предпочитаемое время для встреч на вторую половину дня"
- "Обнови мои компетенции"
- "Я больше не хочу встречи по утрам"`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      category: {
        type: 'string',
        enum: [
          'стиль общения',
          'предпочтения по встречам',
          'компетенции',
          'карьерные цели',
          'рабочий стиль',
          'время фокусной работы',
          'подход к решению задач'
        ],
        description: 'Категория предпочтений для обновления',
      },
      newValue: {
        type: 'string',
        description: 'Новое значение предпочтения',
      },
    },
    required: ['userId', 'category', 'newValue'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, category, newValue } = input;
    
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      // Update preferences in RAG
      await updatePreferencesInRag(userId, category, newValue, workspaceName);
      
      return {
        success: true,
        message: `Предпочтения обновлены: ${category} → ${newValue}`,
        category,
        newValue,
        workspace: workspaceName,
      };
    } catch (error: any) {
      console.error('[UserPreferences] Error updating preferences:', error);
      return {
        success: false,
        message: `Ошибка при обновлении предпочтений: ${error.message}`,
        category,
        workspace: `${userId}_user_key_preferences`,
      };
    }
  },
});
