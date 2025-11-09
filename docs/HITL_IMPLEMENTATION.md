# Human-in-the-Loop (HITL) Implementation

## Обзор

Реализован механизм Human-in-the-Loop для supervisor, который позволяет пользователю утверждать или отклонять решения AI агента в двух ключевых точках:

1. **Утверждение плана работы** - когда TaskPlannerAgent создает план выполнения задачи
2. **Утверждение декомпозиции** - когда DecisionAgent предлагает разбить задачу на подзадачи

## Архитектура

### Компоненты

#### 1. Frontend

- **`HITLApprovalWidget.tsx`** - UI компонент для отображения запроса на утверждение
  - Показывает вопрос и предлагаемый план/решение
  - Позволяет редактировать содержимое
  - Кнопки: Утвердить / Отклонить
  - Поле для комментариев

- **`TranscriptContext.tsx`** - обновлен для поддержки HITL
  - `addHITLApproval()` - добавляет HITL запрос в транскрипт
  - `updateHITLApproval()` - обновляет статус после решения пользователя

- **`Transcript.tsx`** - интегрирует HITL виджет
  - Рендерит `HITLApprovalWidget` для типа `HITL_APPROVAL`
  - Обработчики `handleHITLApprove()` и `handleHITLReject()`

- **`TaskProgressMessage.tsx`** - обрабатывает HITL события из SSE
  - Слушает события типа `hitl_request`
  - Автоматически создает HITL виджет через `addHITLApproval()`

- **`useTaskProgress.ts`** - обновлен для типов HITL событий
  - Добавлены типы: `hitl_request`, `hitl_resolved`
  - Поддержка `hitlData` в `ProgressUpdate`

#### 2. Backend

- **`hitlStore.ts`** - хранилище для HITL запросов
  - `createApproval()` - создает запрос и возвращает Promise, который резолвится при ответе пользователя
  - `resolveApproval()` - резолвит Promise когда пользователь принял решение
  - Auto-timeout через 5 минут

- **`/api/supervisor/unified/hitl/approve/route.ts`** - API для утверждения
  - POST запрос с `sessionId`, `itemId`, `decision`, `modifiedContent`, `feedback`
  - Вызывает `hitlStore.resolveApproval()`

- **`/api/supervisor/unified/hitl/reject/route.ts`** - API для отклонения
  - POST запрос с `sessionId`, `itemId`, `feedback`
  - Вызывает `hitlStore.resolveApproval()` с decision='rejected'

- **`intelligentSupervisor.ts`** - интегрирован HITL
  - **В `generatePlan()`**: после генерации плана запрашивается утверждение
  - **В `breakdownTaskWithSupervisor()`**: если агент решает разбить задачу, запрашивается подтверждение

- **`progressEmitter.ts`** - обновлен для HITL событий
  - Добавлены типы: `hitl_request`, `hitl_resolved`
  - Поддержка `hitlData` в событиях

#### 3. Types

- **`types.ts`** - новые типы
  - `HITLApprovalData` - данные для HITL запроса
  - `TranscriptItem` - добавлен тип `HITL_APPROVAL`
  - Статусы: `WAITING_APPROVAL`, `APPROVED`, `REJECTED`

## Workflow

### 1. План работы (PLAN FIRST mode)

```
User request → IntelligentSupervisor.execute(executionMode='plan')
    ↓
IntelligentSupervisor.generatePlan()
    ↓
TaskPlannerAgent генерирует план
    ↓
emitProgress('hitl_request', hitlData={ type: 'PLAN_APPROVAL', ... })
    ↓
SSE → Frontend → TaskProgressMessage слушает событие
    ↓
addHITLApproval() → создает HITLApprovalWidget в транскрипте
    ↓
User: Approve/Reject/Modify
    ↓
POST /api/supervisor/unified/hitl/approve (или reject)
    ↓
hitlStore.resolveApproval() → резолвит Promise
    ↓
IntelligentSupervisor продолжает выполнение с утвержденным/измененным планом
```

### 2. Декомпозиция задачи

```
TaskOrchestrator → IntelligentSupervisor.breakdownTaskWithSupervisor()
    ↓
DecisionAgent оценивает необходимость декомпозиции
    ↓
if (shouldBreakdown === true):
    emitProgress('hitl_request', hitlData={ type: 'DECOMPOSITION_DECISION', ... })
    ↓
    SSE → Frontend → HITLApprovalWidget
    ↓
    User: Approve/Reject/Modify subtasks
    ↓
    POST /api/supervisor/unified/hitl/approve (или reject)
    ↓
    if approved:
        Продолжить декомпозицию (возможно с измененными подзадачами)
    if rejected:
        Выполнить напрямую без декомпозиции
```

## Использование

### Запуск задачи с планом

```typescript
// Frontend: вызов через tool
delegateToIntelligentSupervisor({
  taskDescription: "Создать отчет по продажам за Q4",
  conversationContext: "...",
  executionMode: "plan" // <- ВАЖНО для HITL плана
});
```

### Автоматическая декомпозиция с HITL

```typescript
// Запускается автоматически при complex задачах
delegateToIntelligentSupervisor({
  taskDescription: "Найти 100 клиентов и отправить каждому email",
  conversationContext: "...",
  executionMode: "auto" // DecisionAgent может предложить декомпозицию
});
```

## Конфигурация

### Timeout

По умолчанию HITL запрос автоматически отклоняется через **5 минут** (настраивается в `hitlStore.ts`):

```typescript
setTimeout(() => {
  if (this.pendingApprovals.has(itemId)) {
    this.resolveApproval(itemId, "rejected", undefined, "Timeout: No user response");
  }
}, 5 * 60 * 1000); // 5 минут
```

### Cleanup

- HITL запросы хранятся **30 минут** после резолва
- SSE соединение закрывается автоматически после `completed` или `error` события

## Расширение

### Добавление нового типа HITL

1. Добавить тип в `HITLApprovalData`:
```typescript
type: "PLAN_APPROVAL" | "DECOMPOSITION_DECISION" | "NEW_TYPE";
```

2. Создать HITL запрос в нужном месте:
```typescript
const approval = await hitlStore.createApproval(
  this.sessionId,
  'NEW_TYPE',
  'Вопрос пользователю',
  'Содержимое для утверждения',
  { /* metadata */ }
);
```

3. Обработать результат:
```typescript
if (approval.resolution?.decision === 'approved') {
  // Продолжить с утвержденными данными
} else {
  // Альтернативный путь
}
```

## Debugging

### Логи

- `[HITLStore]` - хранилище HITL запросов
- `[IntelligentSupervisor]` - генерация плана / декомпозиция
- `[TaskProgressMessage]` - обработка HITL событий на frontend
- `[TranscriptContext]` - создание/обновление HITL виджетов

### Проверка состояния

```typescript
// Backend: проверить pending approvals
const pending = hitlStore.getPendingApprovalsForSession(sessionId);
console.log('Pending:', pending);

// Frontend: проверить транскрипт
const hitlItems = transcriptItems.filter(item => item.type === 'HITL_APPROVAL');
console.log('HITL items:', hitlItems);
```

## Ограничения

1. **Одновременные запросы**: Система поддерживает множественные HITL запросы, но рекомендуется обрабатывать их последовательно
2. **Timeout**: Если пользователь не ответит за 5 минут, запрос автоматически отклоняется
3. **Сохранение состояния**: HITL запросы не персистятся в БД (только в памяти)

## Безопасность

- Валидация `sessionId` на бэкенде
- Проверка существования approval перед резолвом
- Таймаут для предотвращения зависания
- Очистка старых запросов

## Производительность

- HITL не блокирует другие задачи
- SSE используется для real-time обновлений
- Минимальная нагрузка на клиента (только при активных запросах)

## Тестирование

### Manual testing

1. Запустить задачу с `executionMode: 'plan'`
2. Дождаться появления HITL виджета в чате
3. Попробовать: Approve, Reject, Modify + Approve
4. Проверить, что задача продолжается с правильными данными

### Edge cases

- Timeout (не отвечать 5 минут)
- Быстрое последовательное Approve/Reject
- Модификация с невалидными данными
- Disconnect во время ожидания

## Roadmap

- [ ] Персистентное хранилище HITL запросов (Redis/DB)
- [ ] История всех HITL решений пользователя
- [ ] Настройки пользователя (auto-approve определенных типов)
- [ ] HITL для других агентов (не только supervisor)
- [ ] Bulk approve/reject для множественных запросов
