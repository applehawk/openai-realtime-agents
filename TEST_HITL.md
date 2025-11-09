# Тест HITL механизма

## Быстрая проверка

### Шаг 1: Откройте браузер с Developer Tools

1. Откройте приложение в браузере
2. Нажмите F12 (Developer Tools)
3. Перейдите на вкладку Console

### Шаг 2: Добавьте debug логирование

В Console вставьте и выполните:

```javascript
// Мониторинг transcript items
window._debugTranscript = setInterval(() => {
  const items = window.React?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
    ?.ReactCurrentOwner?.current?.memoizedState?.memoizedState;

  // Альтернативный способ
  const hitlItems = document.querySelectorAll('[class*="border-blue"]');
  console.log('[DEBUG] HITL widgets found:', hitlItems.length);
}, 2000);
```

### Шаг 3: Проверьте что виджет рендерится

Попросите у ассистента:

> "Создай подробный план работы для анализа продаж"

### Ожидаемое поведение:

1. **Backend логи** (в терминале):
```
[IntelligentSupervisor] Generating plan with TaskPlannerAgent...
[HITLStore] Created pending approval: { sessionId: 'xxx', itemId: 'hitl-xxx', type: 'PLAN_APPROVAL' }
[ProgressEmitter] Session xxx: hitl_request - Ожидание утверждения плана... (50%)
```

2. **Frontend логи** (в Console):
```
[useTaskProgress] Update: {type: 'hitl_request', hitlData: {…}}
[TaskProgressMessage] HITL request received: {itemId: 'hitl-xxx', type: 'PLAN_APPROVAL', …}
[TranscriptContext] Creating HITL approval request: {sessionId: 'xxx', hitlType: 'PLAN_APPROVAL'}
```

3. **Визуально в интерфейсе**:
   - Появится виджет с голубой рамкой
   - Заголовок: "Утверждение плана работы"
   - Текст плана (редактируемый)
   - Кнопки: "Утвердить" и "Отклонить"

### Шаг 4: Если виджет не появился

Вставьте в Console:

```javascript
// Прямая проверка transcript items
const provider = document.querySelector('[data-transcript-provider]');
console.log('Transcript items:', window.__TRANSCRIPT_ITEMS__);

// Или найдите через React DevTools:
// Components → TranscriptProvider → hooks → State (transcriptItems)
```

### Альтернативный тест через API

Если UI не работает, проверьте API напрямую:

```bash
# Terminal 1: Смотрите логи
npm run dev

# Terminal 2: Тестируйте HITL store
curl -X POST http://localhost:3000/api/test-hitl \
  -H "Content-Type: application/json"
```

Создайте тестовый endpoint:

```typescript
// src/app/api/test-hitl/route.ts
import { hitlStore } from '../supervisor/unified/hitlStore';

export async function POST() {
  const { approval, promise } = hitlStore.createApproval(
    'test-session',
    'PLAN_APPROVAL',
    'Test question?',
    'Test content',
    { test: true }
  );

  // Auto-approve after 2 seconds
  setTimeout(() => {
    hitlStore.resolveApproval(approval.itemId, 'approved');
  }, 2000);

  const result = await promise;

  return Response.json({
    success: true,
    itemId: approval.itemId,
    resolution: result.resolution
  });
}
```

Затем:
```bash
curl -X POST http://localhost:3000/api/test-hitl
# Должно вернуть через 2 секунды:
# {"success":true,"itemId":"hitl-test-session-xxx","resolution":{"decision":"approved"}}
```

## Что смотреть в логах

### Backend (Terminal):
✅ `[HITLStore] Created pending approval`
✅ `[ProgressEmitter] hitl_request`
✅ `[SSE Stream] Client connected`

### Frontend (Browser Console):
✅ `[useTaskProgress] SSE connection opened`
✅ `[useTaskProgress] Update: {type: 'hitl_request'}`
✅ `[TaskProgressMessage] HITL request received`
✅ `[TranscriptContext] Creating HITL approval request`

### Network Tab:
✅ `GET /api/supervisor/unified/stream?sessionId=xxx` → Status 200, Type: eventsource
✅ EventStream содержит событие с `"type":"hitl_request"`

## Если HITL не работает

1. **itemId не совпадают**: Исправлено - теперь используется один itemId из hitlStore
2. **SSE не подключается**: Проверьте что sessionId правильный
3. **События не обрабатываются**: Проверьте `processedHITLs` Set в TaskProgressMessage
4. **Виджет не рендерится**: Проверьте условие `type === "HITL_APPROVAL"` в Transcript.tsx

## Успех выглядит так:

В интерфейсе чата появляется виджет:

```
┌────────────────────────────────────────┐
│ 📝 Утверждение плана работы      10:30│
├────────────────────────────────────────┤
│ Пожалуйста, проверьте и утвердите план│
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Сложность: medium                  │ │
│ │ Шагов: 5                           │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ 1. Собрать данные                  │ │
│ │ 2. Проанализировать...             │ │
│ │ ...                                │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Комментарий (опционально):            │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [✏️ Редактировать] [✓ Утвердить] [✗ Отклонить]│
└────────────────────────────────────────┘
```
