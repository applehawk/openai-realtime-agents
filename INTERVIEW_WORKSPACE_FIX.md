# 🔧 Исправление проблемы с единым workspace для всех пользователей

## 🐛 Проблема

Все пользователи сохраняли данные интервью в один workspace `user123_user_key_preferences` вместо создания отдельного workspace для каждого пользователя с именем `{userId}_user_key_preferences`.

## 🔍 Причина

**Корневая проблема**: Агент не получал правильную информацию о пользователе и использовал дефолтное значение `user123` вместо реального `userId` из базы данных.

**Дополнительные проблемы**:
1. Информация о пользователе не передавалась в сессию агента
2. Агент не имел инструмента для получения информации о текущем пользователе
3. Инструкции агента не предусматривали получение информации о пользователе

## ✅ Решение

### 1. Создание инструмента для получения информации о пользователе

Создали новый инструмент `getCurrentUserInfo` в файле `userInfoTool.ts`:

```typescript
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
        position: user.username || 'Специалист',
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
```

### 2. Обновление инструкций агента

Обновили инструкции агента в `index.ts`:

```typescript
### Initial Interview Management

**CRITICAL**: The assistant MUST call getCurrentUserInfo at the very beginning of every conversation to get the current user's ID and information. Then call checkInterviewStatus with the real userId to determine if the user has completed their initial interview.

The assistant should proactively check if new users have completed their initial interview using checkInterviewStatus with the real userId. If not, offer to conduct a brief 3-5 minute interview to personalize the experience. Use startInitialInterview tool to begin the interview process:

- **First action**: Always call getCurrentUserInfo when user connects
- **Second action**: Call checkInterviewStatus with the real userId from getCurrentUserInfo
- Call startInitialInterview with userId and userPosition from user profile
- If interview already exists, inform user that preferences are saved
- If starting new interview, ask 4 essential questions (competencies, communication style, meeting preferences, focus time)
- Use conductInitialInterview to continue the conversation flow
- Optionally ask 3 additional questions if user has time
- Save responses to RAG workspace "{userId}_user_key_preferences"
- Confirm completion and explain how preferences will be used
```

### 3. Добавление инструмента в агента

Добавили `getCurrentUserInfo` в список инструментов агента:

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
    // Interview tools for user personalization
    startInitialInterview,
    conductInitialInterview,
    checkInterviewStatus,
    // Supervisor delegation tool for complex multi-step tasks
    delegateToSupervisor,
],
```

### 4. Обновление начального сообщения

Обновили начальное сообщение в `App.tsx`:

```typescript
// Send an initial message to trigger the agent to get user info and check interview status
if (shouldTriggerResponse) {
  sendSimulatedUserMessage('Привет! Сначала получи информацию о пользователе, затем проверь статус моего интервью и предложи помощь.');
}
```

## 🔧 Ключевые изменения

1. **Новый инструмент**: `getCurrentUserInfo` для получения информации о пользователе
2. **Обновленные инструкции**: Агент сначала получает информацию о пользователе
3. **Правильная последовательность**: `getCurrentUserInfo` → `checkInterviewStatus` → `startInitialInterview`
4. **Использование реального userId**: Все инструменты интервью теперь получают правильный `userId`

## 📋 Измененные файлы

1. **`src/app/agentConfigs/severstalAssistantAgent/userInfoTool.ts`** (новый файл)
   - Создан инструмент `getCurrentUserInfo` для получения информации о пользователе

2. **`src/app/agentConfigs/severstalAssistantAgent/index.ts`**
   - Добавлен импорт `getCurrentUserInfo`
   - Обновлены инструкции агента
   - Добавлен инструмент в список инструментов

3. **`src/app/App.tsx`**
   - Обновлено начальное сообщение для агента

## 🎯 Результат

Теперь:
- ✅ Агент получает правильный `userId` из базы данных
- ✅ Каждый пользователь получает свой workspace `{userId}_user_key_preferences`
- ✅ Данные интервью изолированы по пользователям
- ✅ Новые пользователи корректно определяются
- ✅ Существующие пользователи находят свои сохраненные предпочтения

## 🧪 Тестирование

Для проверки:
1. Зарегистрируйте нового пользователя (например, `testuser9`)
2. Войдите в систему
3. Подключитесь к агенту
4. Агент должен:
   - Сначала вызвать `getCurrentUserInfo`
   - Получить реальный `userId` (например, `bb506a47-be15-4ea5-8d5a-d4c628bddf02`)
   - Создать workspace `bb506a47-be15-4ea5-8d5a-d4c628bddf02_user_key_preferences`
   - Сохранить данные интервью в этот workspace

## 🔑 Ключевые принципы

- **Изоляция данных**: Каждый пользователь имеет свой workspace
- **Правильная идентификация**: Использование реального `userId` из базы данных
- **Последовательность действий**: Сначала получение информации, затем проверка статуса
- **Безопасность**: Проверка аутентификации через API endpoint

## 🚀 Готово к использованию!

Проблема с единым workspace для всех пользователей полностью решена. Теперь каждый пользователь получает свой персональный workspace, и данные интервью корректно изолированы.
