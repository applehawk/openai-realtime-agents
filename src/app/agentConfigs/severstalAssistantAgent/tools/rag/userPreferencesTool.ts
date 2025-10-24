import { tool } from '@openai/agents/realtime';

// Use API proxy endpoint for client-side execution
const RAG_API_PROXY = '/api/rag';

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy
 */
async function callRagServerForPreferences(query: string, workspace: string) {
  try {
    console.log(`[UserPreferences] Querying workspace: ${workspace}`);

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`RAG server returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RAG server error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Extract text content from MCP response format
    if (data.result?.content?.[0]?.text) {
      return data.result.content[0].text;
    }

    return JSON.stringify(data.result || data);
  } catch (error: any) {
    console.error(`[UserPreferences] Error:`, error);
    throw new Error(`Ошибка подключения к базе знаний: ${error.message}`);
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
