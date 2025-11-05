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

/**
 * LightRAG Insert Text Tool - для вставки текста в RAG систему
 */
export const lightragInsertText = tool({
  name: 'lightrag_insert_text',
  description: `Вставить текст в RAG систему для последующего поиска и использования.

Полезно для:
- Добавления новых документов в RAG систему
- Обновления базы знаний
- Импорта текстовых данных

Вставленный текст будет обработан и добавлен в knowledge graph.`,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Текст для вставки в RAG систему',
      },
      file_source: {
        type: 'string',
        description: 'Источник текста (опционально)',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['text'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { text, file_source = '', workspace } = input;
    const args: any = {
      text,
    };

    if (file_source) args.file_source = file_source;
    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_insert_text', args);
  },
});

/**
 * LightRAG Search Labels Tool - поиск меток в knowledge graph
 */
export const lightragSearchLabels = tool({
  name: 'lightrag_search_labels',
  description: `Поиск меток в knowledge graph с нечетким совпадением.

Полезно для:
- Поиска существующих entities в knowledge graph
- Исследования структуры данных
- Навигации по графу знаний

Возвращает список найденных меток с нечетким поиском.`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Поисковый запрос для меток',
      },
      limit: {
        type: 'number',
        description: 'Максимальное количество результатов (1-1000)',
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
    const { query, limit = 100, workspace } = input;
    const args: any = {
      query,
      limit,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_search_labels', args);
  },
});

/**
 * LightRAG Check Entity Exists Tool - проверка существования entity
 */
export const lightragCheckEntityExists = tool({
  name: 'lightrag_check_entity_exists',
  description: `Проверить существование entity с заданным именем в knowledge graph.

Полезно для:
- Проверки существования entity перед операциями
- Валидации данных
- Предотвращения дублирования

Возвращает true/false в зависимости от существования entity.`,
  parameters: {
    type: 'object',
    properties: {
      entity_name: {
        type: 'string',
        description: 'Имя entity для проверки',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['entity_name'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { entity_name, workspace } = input;
    const args: any = {
      entity_name,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_check_entity_exists', args);
  },
});

/**
 * LightRAG Update Entity Tool - обновление entity в knowledge graph
 */
export const lightragUpdateEntity = tool({
  name: 'lightrag_update_entity',
  description: `Обновить свойства entity в knowledge graph.

Полезно для:
- Обновления информации об entity
- Корректировки данных в knowledge graph
- Модификации свойств объектов

⚠️ Внимание: Изменения сохраняются в knowledge graph.`,
  parameters: {
    type: 'object',
    properties: {
      entity_name: {
        type: 'string',
        description: 'Имя entity для обновления',
      },
      properties: {
        type: 'object',
        description: 'Новые свойства entity в формате JSON',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['entity_name', 'properties'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { entity_name, properties, workspace } = input;
    const args: any = {
      entity_name,
      properties,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_update_entity', args);
  },
});

/**
 * LightRAG Update Relation Tool - обновление связи между entities
 */
export const lightragUpdateRelation = tool({
  name: 'lightrag_update_relation',
  description: `Обновить свойства связи между entities в knowledge graph.

Полезно для:
- Обновления связей между entities
- Модификации отношений в knowledge graph
- Корректировки структуры данных

⚠️ Внимание: Изменения сохраняются в knowledge graph.`,
  parameters: {
    type: 'object',
    properties: {
      source_entity: {
        type: 'string',
        description: 'Имя source entity',
      },
      target_entity: {
        type: 'string',
        description: 'Имя target entity',
      },
      relation_type: {
        type: 'string',
        description: 'Тип связи',
      },
      properties: {
        type: 'object',
        description: 'Новые свойства связи в формате JSON',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['source_entity', 'target_entity', 'relation_type', 'properties'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { source_entity, target_entity, relation_type, properties, workspace } = input;
    const args: any = {
      source_entity,
      target_entity,
      relation_type,
      properties,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_update_relation', args);
  },
});

/**
 * LightRAG Delete Entity Tool - удаление entity из knowledge graph
 */
export const lightragDeleteEntity = tool({
  name: 'lightrag_delete_entity',
  description: `Удалить entity и все её связи из knowledge graph.

⚠️ ВНИМАНИЕ: Это необратимая операция! Entity и все связанные с ней отношения будут удалены навсегда.

Полезно для:
- Удаления ненужных entities
- Очистки knowledge graph
- Управления данными

Используйте с осторожностью!`,
  parameters: {
    type: 'object',
    properties: {
      entity_name: {
        type: 'string',
        description: 'Имя entity для удаления',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['entity_name'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { entity_name, workspace } = input;
    const args: any = {
      entity_name,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_delete_entity', args);
  },
});

/**
 * LightRAG Delete Relation Tool - удаление связи между entities
 */
export const lightragDeleteRelation = tool({
  name: 'lightrag_delete_relation',
  description: `Удалить связь между двумя entities из knowledge graph.

⚠️ ВНИМАНИЕ: Это необратимая операция! Связь будет удалена навсегда.

Полезно для:
- Удаления неправильных связей
- Корректировки knowledge graph
- Управления отношениями

Используйте с осторожностью!`,
  parameters: {
    type: 'object',
    properties: {
      source_entity: {
        type: 'string',
        description: 'Имя source entity',
      },
      target_entity: {
        type: 'string',
        description: 'Имя target entity',
      },
      relation_type: {
        type: 'string',
        description: 'Тип связи для удаления',
      },
      workspace: {
        type: 'string',
        description: 'Имя workspace (опционально)',
      },
    },
    required: ['source_entity', 'target_entity', 'relation_type'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { source_entity, target_entity, relation_type, workspace } = input;
    const args: any = {
      source_entity,
      target_entity,
      relation_type,
    };

    if (workspace) args.workspace = workspace;

    return await callRagServer('lightrag_delete_relation', args);
  },
});
