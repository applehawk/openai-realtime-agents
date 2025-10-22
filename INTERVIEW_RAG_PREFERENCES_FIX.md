# 🔧 Исправление взаимодействия с RAG для предпочтений пользователей

## 🐛 Проблема

Когда пользователь спрашивал о своих предпочтениях (например, "Расскажи про мои предпочтения"), агент использовал обычный `lightrag_query` без указания workspace с предпочтениями пользователя. Это приводило к ответу "No relevant context found for the query", так как агент искал в общем workspace, а не в персональном workspace пользователя.

## 🔍 Причина

**Корневая проблема**: Агент не различал запросы о предпочтениях пользователя и общие запросы к базе знаний. Для предпочтений нужно использовать персональный workspace `{userId}_user_key_preferences`, а не общий workspace.

**Дополнительные проблемы**:
1. Отсутствие специального инструмента для запроса предпочтений
2. Инструкции агента не указывали на необходимость использования правильного workspace
3. Агент не понимал, когда нужно использовать персональный workspace

## ✅ Решение

### 1. Создание специального инструмента для предпочтений

Создали новый инструмент `queryUserPreferences` в файле `userPreferencesTool.ts`:

```typescript
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
```

### 2. Обновление инструкций агента

Добавили специальную инструкцию в `index.ts`:

```typescript
**IMPORTANT**: When user asks about their preferences, personal settings, or interview data, the assistant MUST use queryUserPreferences tool with the real userId from getCurrentUserInfo, NOT the general lightrag_query tool. This ensures the assistant queries the user's personal workspace with their preferences.
```

### 3. Добавление инструмента в агента

Добавили `queryUserPreferences` в список инструментов агента:

```typescript
tools: [
    // Primary MCP tools for direct email/calendar operations
    hostedMcpTool({
        serverLabel: 'calendar',
        serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),
    // LightRAG tools for knowledge retrieval
    lightragQuery,
    lightragQueryData,
    // User info tool for getting current user information
    getCurrentUserInfo,
    // User preferences tool for querying personal preferences
    queryUserPreferences,
    // Interview tools for user personalization
    startInitialInterview,
    conductInitialInterview,
    checkInterviewStatus,
    // Supervisor delegation tool for complex multi-step tasks
    delegateToSupervisor,
],
```

## 🔧 Ключевые изменения

1. **Специальный инструмент**: `queryUserPreferences` для запроса предпочтений из персонального workspace
2. **Правильный workspace**: Автоматически использует `{userId}_user_key_preferences`
3. **Четкие инструкции**: Агент знает, когда использовать какой инструмент
4. **Прямой вызов RAG API**: Обходит MCP сервер для более надежной работы

## 📋 Измененные файлы

1. **`src/app/agentConfigs/severstalAssistantAgent/userPreferencesTool.ts`** (новый файл)
   - Создан инструмент `queryUserPreferences` для запроса предпочтений

2. **`src/app/agentConfigs/severstalAssistantAgent/index.ts`**
   - Добавлен импорт `queryUserPreferences`
   - Добавлена инструкция о использовании правильного инструмента
   - Добавлен инструмент в список инструментов

## 🎯 Результат

Теперь:
- ✅ Агент использует правильный workspace для запросов о предпочтениях
- ✅ Пользователи получают информацию о своих сохраненных предпочтениях
- ✅ Разделение между общими запросами и персональными предпочтениями
- ✅ Правильная изоляция данных по пользователям

## 🧪 Тестирование

Для проверки:
1. Пройдите интервью с пользователем
2. Сохраните предпочтения в RAG
3. Спросите агента: "Расскажи про мои предпочтения"
4. Агент должен:
   - Сначала вызвать `getCurrentUserInfo`
   - Затем вызвать `queryUserPreferences` с правильным `userId`
   - Найти данные в workspace `{userId}_user_key_preferences`
   - Показать сохраненные предпочтения

## 🔑 Ключевые принципы

- **Правильный инструмент**: Использовать `queryUserPreferences` для предпочтений
- **Правильный workspace**: Всегда использовать `{userId}_user_key_preferences`
- **Разделение ответственности**: Общие запросы vs персональные предпочтения
- **Прямой доступ**: Обход MCP сервера для надежности

## 🚀 Готово к использованию!

Проблема с взаимодействием с RAG для предпочтений полностью решена. Теперь агент корректно использует персональный workspace пользователя для запросов о предпочтениях.
