import { tool } from '@openai/agents/realtime';

// Use API proxy endpoint for client-side execution
// This endpoint runs on the server and forwards requests to the RAG MCP server
const RAG_API_PROXY = '/api/rag';

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy
 *
 * NOTE: This function executes in the browser (client-side) during Realtime API sessions.
 * We use a server-side proxy endpoint to avoid CORS and mixed content issues.
 */
async function callRagServer(toolName: string, args: any) {
  try {
    console.log(`[RAG] Calling ${toolName} with args:`, args);

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`RAG server returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RAG server error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    console.log(`[RAG] ${toolName} completed successfully`);

    // Extract text content from MCP response format
    if (data.result?.content?.[0]?.text) {
      return data.result.content[0].text;
    }

    return JSON.stringify(data.result || data);
  } catch (error: any) {
    console.error(`[RAG] Error calling ${toolName}:`, error);
    throw new Error(`Ошибка подключения к базе знаний: ${error.message}`);
  }
}

/**
 * LightRAG Query Tool - основной инструмент для RAG запросов
 */
export const lightragQuery = tool({
  name: 'lightrag_query',
  description: `Выполнить RAG запрос к LightRAG для поиска информации в базе знаний (emails, документы, встречи, заметки).

Поддерживает различные режимы:
- mix (рекомендуется) - интеграция графа и векторов
- local - фокус на конкретных entities
- global - анализ паттернов
- hybrid - комбинированный подход
- naive - только vector search
- bypass - прямой запрос к LLM

Всегда возвращает ответ на русском языке с ссылками на источники (если include_references=true).`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Текст запроса (минимум 3 символа). Примеры: "Что писали про проект Восток?", "Напомни задачи прошлого месяца"',
      },
      mode: {
        type: 'string',
        enum: ['local', 'global', 'hybrid', 'naive', 'mix', 'bypass'],
        description: 'Режим запроса. По умолчанию "mix" (рекомендуется)',
      },
      include_references: {
        type: 'boolean',
        description: 'Включить ссылки на источники',
      },
      response_type: {
        type: 'string',
        description: 'Формат ответа (например "Multiple Paragraphs", "Single Paragraph", "Bullet Points")',
      },
      top_k: {
        type: 'number',
        description: 'Количество top entities/relations для извлечения',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { query, mode = 'mix', include_references = true, response_type, top_k, workspace } = input;
    const args: any = {
      query,
      mode,
      include_references,
    };

    if (response_type) args.response_type = response_type;
    if (top_k) args.top_k = top_k;
    if (workspace) args.workspace = workspace;

    const result = await callRagServer('lightrag_query', args);

    // Try to parse JSON response if it looks like JSON
    try {
      const parsed = JSON.parse(result);
      if (parsed.response) {
        return parsed.response;
      }
    } catch {
      // Not JSON or doesn't have .response field, return as is
    }

    return result;
  },
});

/**
 * LightRAG Query Data Tool - для получения структурированных данных
 */
export const lightragQueryData = tool({
  name: 'lightrag_query_data',
  description: `Получить структурированные данные RAG запроса (entities, relationships, chunks) БЕЗ генерации LLM ответа.

Полезно для:
- Анализа данных и отладки
- Извлечения конкретных entities и relationships
- Получения исходных text chunks

Возвращает: entities, relationships, keywords, source chunks в структурированном формате.`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Текст запроса для анализа',
      },
      mode: {
        type: 'string',
        enum: ['local', 'global', 'hybrid', 'naive', 'mix', 'bypass'],
        description: 'Режим поиска',
      },
      top_k: {
        type: 'number',
        description: 'Количество top entities/relationships',
      },
      chunk_top_k: {
        type: 'number',
        description: 'Количество text chunks',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { query, mode = 'mix', top_k, chunk_top_k, workspace } = input;
    const args: any = {
      query,
      mode,
    };

    if (top_k) args.top_k = top_k;
    if (chunk_top_k) args.chunk_top_k = chunk_top_k;
    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_query_data', args);
  },
});
