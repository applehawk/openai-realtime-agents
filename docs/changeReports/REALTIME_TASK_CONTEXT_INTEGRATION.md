# Real-time Task Context Integration

**Version:** 1.0  
**Date:** 2025-10-25  
**Status:** ✅ Completed

---

## Overview

Реализована передача контекста выполнения задач (`rootTask` и `subtasks`) из `IntelligentSupervisor` в `routerAgent` в режиме реального времени через SSE (Server-Sent Events).

### Цель

Предоставить `routerAgent` visibility в текущее состояние выполняемых задач, чтобы агент мог:
- Информировать пользователя о прогрессе выполнения задач
- Отвечать на вопросы "что сейчас делается?"
- Предоставлять контекстно-осведомленные ответы во время длительных операций

---

## Architecture

### Understanding GPT-Realtime Context

**ВАЖНО:** Realtime Agent context работает не через conversation history, а через `extraContext`!

- **extraContext** передается при создании RealtimeSession (static)
- Доступен в tools через `details.context`
- Conversation history содержит только `message` items (user/assistant)
- TASK_PROGRESS/Breadcrumbs - это только UI элементы, агент их НЕ видит автоматически

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. RealtimeSession создается с extraContext                         │
│    - addTranscriptBreadcrumb                                        │
│    - addTaskProgressMessage                                         │
│    - updateTaskProgress                                             │
│    - getTaskContext: (sessionId) => TaskContext                     │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. RouterAgent вызывает delegateToIntelligentSupervisor             │
│    - Tool возвращает sessionId в response                           │
│    - Agent сохраняет sessionId для последующих запросов             │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. IntelligentSupervisor выполняет задачу                           │
│    - emitProgress() → TaskContextStore.setContext()                 │
│    - hierarchicalBreakdown сохраняется в store                      │
│    - SSE updates → UI (TASK_PROGRESS messages)                      │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. User спрашивает: "Что ты делаешь?"                               │
│    RouterAgent вызывает getTaskContext(sessionId)                   │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. getTaskContext tool                                              │
│    - Использует details.context.getTaskContext(sessionId)           │
│    - Получает TaskContext из store                                  │
│    - Возвращает user-friendly data агенту                           │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. RouterAgent отвечает пользователю                                │
│    "Работаю над встречей. Уже нашёл время, сейчас создаю событие"  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. IntelligentSupervisor - Отправка контекста через SSE

**Файл:** `src/app/api/supervisor/unified/intelligentSupervisor.ts`

**Изменения:**
- Добавлен import `taskContextStore`
- Модифицирован `emitProgress()` для обновления store при наличии `hierarchicalBreakdown`
- В `executeDirectly()` и `executeFlatWorkflow()` передается `hierarchicalBreakdown` с полной структурой задачи

**Пример структуры данных:**
```typescript
{
  hierarchicalBreakdown: {
    taskId: 'task-root',
    description: 'Прочитай письмо от Анны и назначь встречу',
    status: 'in_progress',
    complexity: 'medium',
    executionStrategy: 'flat',
    result: undefined,
    subtasks: [
      {
        taskId: 'task-root.0',
        description: 'Прочитать последнее письмо от Анны',
        status: 'completed',
        result: 'Письмо прочитано: Анна предлагает встречу завтра в 15:00'
      },
      {
        taskId: 'task-root.1',
        description: 'Создать событие в календаре',
        status: 'in_progress',
        result: undefined
      }
    ]
  },
  strategy: 'flat',
  complexity: 'medium'
}
```

### 2. TaskContextStore - Глобальное хранилище

**Файл:** `src/app/api/supervisor/unified/taskContextStore.ts`

**Функциональность:**
- Singleton pattern для глобального доступа
- `Map<sessionId, TaskContext>` для хранения контекстов
- TTL: 30 минут для каждого контекста
- Автоматическая очистка устаревших контекстов каждые 5 минут

**API:**
```typescript
interface TaskContext {
  sessionId: string;
  hierarchicalBreakdown: {
    taskId: string;
    description: string;
    status: 'planned' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    complexity?: 'simple' | 'medium' | 'complex';
    executionStrategy?: 'direct' | 'flat' | 'hierarchical';
    result?: string;
    subtasks?: any[];
  };
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  lastUpdate: number;
  strategy: 'direct' | 'flat' | 'hierarchical';
  complexity: 'simple' | 'medium' | 'complex';
}

// Methods
taskContextStore.setContext(sessionId, context)
taskContextStore.getContext(sessionId)
taskContextStore.getAllContexts()
taskContextStore.removeContext(sessionId)
```

### 3. getTaskContext Tool - Доступ к контексту задач

**Файл:** `src/app/agentConfigs/severstalAssistantAgent/tools/getTaskContextTool.ts`

**Функциональность:**
- Tool для получения текущего состояния задачи по sessionId
- Использует `details.context.getTaskContext` из extraContext
- Возвращает user-friendly данные о задаче и прогрессе

**API:**
```typescript
// Input
{ sessionId: string }

// Output (success)
{
  success: true,
  sessionId: string,
  task: {
    description: string,
    status: 'in_progress' | 'completed' | ...,
    complexity: 'simple' | 'medium' | 'complex',
    strategy: 'direct' | 'flat' | 'hierarchical',
    result?: string,
    subtasks: [
      { number: 1, description: string, status: string, result?: string },
      ...
    ],
    totalSubtasks: number
  },
  progress: {
    percentage: number,
    message: string
  }
}
```

### 4. extraContext Configuration - Связь с TaskContextStore

**Файл:** `src/app/App.tsx`

**Добавлено в extraContext:**
```typescript
extraContext: {
  addTranscriptBreadcrumb,
  addTaskProgressMessage,
  updateTaskProgress,
  // NEW: Access to task context
  getTaskContext: async (sessionId: string) => {
    const { taskContextStore } = await import('./api/supervisor/unified/taskContextStore');
    return taskContextStore.getContext(sessionId);
  },
}
```

### 5. RouterAgent - Awareness через getTaskContext tool

**Файл:** `src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts`

**Добавлена секция:**
```markdown
## Контекст выполнения задач (NEW)

- При вызове delegateToIntelligentSupervisor ты получаешь sessionId в ответе
- Этот sessionId позволяет отслеживать состояние задачи
- Если пользователь спрашивает "что ты делаешь?":
  1. Вызови getTaskContext(sessionId)
  2. Расскажи на естественном языке что делается
- НЕ говори технические детали
- Говори НА ЯЗЫКЕ ПОЛЬЗОВАТЕЛЯ о реальных действиях
```

---

## Design Decisions

### Почему нужен Tool вместо автоматического доступа?

**Решение:** getTaskContext tool использует extraContext для доступа к store

**Причины:**
1. **Realtime Architecture**: Agent не видит UI breadcrumbs в conversation history
2. **extraContext Pattern**: Правильный способ передачи функций агенту по документации OpenAI
3. **On-demand Access**: Agent запрашивает контекст только когда нужно
4. **Type Safety**: Tool имеет типизированный API с validation

### Почему используется только hierarchicalBreakdown?

**Решение:** Одна структура вместо rootTask + subtasks

**Причины:**
1. **No duplication**: hierarchicalBreakdown уже содержит всю информацию
2. **Consistent structure**: Единая структура для всех стратегий (direct/flat/hierarchical)
3. **Recursive support**: hierarchicalBreakdown.subtasks[] может быть многоуровневым

---

## Usage Examples

### Example 1: Simple Task (Direct execution)

**User:** "Прочитай последнее письмо"

**Flow:**
1. RouterAgent → delegateToIntelligentSupervisor
2. IntelligentSupervisor оценивает сложность: simple
3. Выбирает стратегию: direct
4. Выполняет через WorkflowOrchestratorAgent
5. Отправляет через SSE:
```json
{
  "hierarchicalBreakdown": {
    "taskId": "task-root",
    "description": "Прочитай последнее письмо",
    "status": "completed",
    "complexity": "simple",
    "result": "Последнее письмо от Ивана с темой 'Встреча'...",
    "subtasks": []
  },
  "progress": { "percentage": 100 }
}
```

### Example 2: Medium Task (Flat workflow)

**User:** "Найди свободное время и создай встречу с Петром"

**Flow:**
1. RouterAgent → delegateToIntelligentSupervisor
2. IntelligentSupervisor оценивает: medium
3. Стратегия: flat
4. Выполняет workflow:
   - Step 1: Получить события календаря
   - Step 2: Найти свободное время
   - Step 3: Создать событие
5. На каждом шаге отправляет updates через SSE
6. RouterAgent видит прогресс в history:
   - "Сейчас проверяю календарь..."
   - "Нашел свободное время завтра в 14:00"
   - "Создаю событие..."

### Example 3: User asks during execution

**User:** "Что ты сейчас делаешь?"

**Flow:**
1. RouterAgent видит sessionId из последнего вызова delegateToIntelligentSupervisor
2. Calls: `getTaskContext(sessionId: "session-123-abc")`
3. Receives:
```json
{
  "success": true,
  "task": {
    "description": "Найти свободное время и создать встречу с Петром",
    "status": "in_progress",
    "subtasks": [
      { "number": 1, "description": "Получить события календаря", "status": "completed" },
      { "number": 2, "description": "Найти свободное время", "status": "completed" },
      { "number": 3, "description": "Создать событие", "status": "in_progress" }
    ],
    "totalSubtasks": 3
  },
  "progress": { "percentage": 66 }
}
```
4. RouterAgent responds: "Работаю над встречей с Петром. Уже проверил календарь и нашел свободное время. Сейчас создаю событие."

---

## Benefits

### 1. Real-time Awareness
- Agent знает о текущем состоянии задач
- Может отвечать на вопросы о прогрессе
- Видит структуру и подзадачи

### 2. Better UX
- Пользователь получает информативные ответы
- Понимает что происходит во время длительных операций
- Natural language communication вместо технических деталей

### 3. No Additional Complexity
- Нет дополнительных tools
- Нет HTTP запросов для получения контекста
- Автоматическая передача через существующий SSE канал

### 4. Scalable
- TaskContextStore поддерживает множество одновременных сессий
- TTL и auto-cleanup предотвращают утечки памяти
- Независимая работа каждой сессии

---

## Testing

### Manual Testing Checklist

- [ ] Простая задача (direct): контекст передается корректно
- [ ] Средняя задача (flat): видны все subtasks
- [ ] Сложная задача (hierarchical): вложенные подзадачи видны
- [ ] User спрашивает о прогрессе во время выполнения
- [ ] RouterAgent использует контекст в ответах
- [ ] TTL очистка работает корректно
- [ ] Множественные одновременные сессии не конфликтуют

---

## Future Enhancements

### Potential improvements:

1. **Progressive updates во время hierarchical execution**
   - Сейчас: контекст обновляется только на ключевых событиях
   - Будущее: real-time updates для каждой subtask

2. **Rich context в prompt**
   - Сейчас: agent читает из history
   - Будущее: автоматическое включение текущего контекста в system prompt

3. **Cancellation support**
   - Возможность отменить выполняемую задачу через routerAgent

---

## Files Changed

### Created:
- `src/app/api/supervisor/unified/taskContextStore.ts`
- `src/app/agentConfigs/severstalAssistantAgent/tools/getTaskContextTool.ts`

### Modified:
- `src/app/api/supervisor/unified/intelligentSupervisor.ts`
- `src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts`
- `src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts`
- `src/app/agentConfigs/severstalAssistantAgent/tools/intelligentSupervisorTool.ts` (returns sessionId)
- `src/app/App.tsx` (adds getTaskContext to extraContext)

---

## Summary

✅ **Completed:**
1. Добавлена отправка hierarchicalBreakdown через SSE в IntelligentSupervisor
2. Создано глобальное хранилище TaskContextStore с TTL и auto-cleanup
3. Создан getTaskContext tool для доступа к состоянию задач
4. Добавлена функция getTaskContext в extraContext RealtimeSession
5. delegateToIntelligentSupervisor теперь возвращает sessionId
6. Обновлен prompt routerAgent с инструкциями использования getTaskContext

✅ **Result:**
RouterAgent теперь может:
- Получать sessionId при делегировании задач
- Вызывать getTaskContext(sessionId) для проверки состояния
- Информировать пользователя о прогрессе на естественном языке
- Работать в соответствии с архитектурой GPT-Realtime (extraContext pattern)

