# Testing Guide: Real-time Progress Tracking

## Быстрый старт

### 1. Запуск приложения

```bash
npm run dev
```

Открыть: http://localhost:3000

### 2. Выбор сценария

В dropdown (правый верхний угол):
- Выбрать: **"Severstal Assistant"**

### 3. Тестовые команды

#### Простая задача (direct strategy):
```
"Покажи встречи на завтра"
```

Ожидаемый прогресс:
- 0% → 20% → 30% → 40% → 90% → 100%
- ~3-5 секунд

#### Средняя задача (flat strategy):
```
"Прочитай письмо от Анны и назначь встречу"
```

Ожидаемый прогресс:
- 0% → 10% → 20% → 30% → 40% → 90% → 100%
- ~5-8 секунд
- Должно быть 3-5 workflow steps

#### Сложная задача (hierarchical strategy):
```
"Найди всех участников проекта Восток и отправь им приглашения на встречу"
```

Ожидаемый прогресс:
- 0% → 10% → 20% → 30% → 40% → ... → 90% → 100%
- ~10-15 секунд
- Множественные промежуточные обновления

---

## Что проверять

### ✅ TaskProgressIndicator появляется

**Где:** Вверху transcript панели (левая панель)

**Когда:** Сразу после вызова delegateToIntelligentSupervisor

**Внешний вид:**
```
┌─────────────────────────────────────────────────────┐
│ ✓ Задача выполнена              🟢 Connected       │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%              │
│ Задача выполнена успешно                            │
│ Прогресс: 100%                                      │
│ > Показать детали (7 обновлений)                    │
└─────────────────────────────────────────────────────┘
```

### ✅ Progress bar обновляется

- Начало: пустая (0%)
- Процесс: заполняется постепенно (синяя)
- Завершено: полная (100%, зелёная)
- Ошибка: красная

### ✅ Messages обновляются в real-time

Примеры сообщений:
- "Начинаю выполнение задачи..."
- "Оцениваю сложность задачи..."
- "Сложность определена: medium"
- "Стратегия выбрана: flat"
- "Выполняю многошаговую задачу..."
- "Многошаговая задача выполнена (5 шагов)"
- "Задача выполнена успешно"

### ✅ Connection status работает

- 🟢 **Connected** - во время выполнения
- 🔴 **Disconnected** - после завершения или при ошибке

### ✅ Collapsible details

Нажать "Показать детали (N обновлений)":
- Должен открыться список всех progress updates
- Каждое обновление показывает:
  - Timestamp (HH:MM:SS)
  - Event type (started, completed, etc.)
  - Message
  - Details (JSON, collapsible)

---

## Debugging

### Browser DevTools

#### Console

Должны быть логи:
```
[TranscriptContext] Auto-detected sessionId: session-1234567890-abc
[TaskProgressIndicator] Connecting to SSE stream for session: session-xxx
[TaskProgressIndicator] SSE connection opened
[TaskProgressIndicator] Update received: { type: 'started', progress: 0, ... }
[TaskProgressIndicator] Update received: { type: 'completed', progress: 100, ... }
[TaskProgressIndicator] Closing SSE connection
```

#### Network

Tab: **EventStream** или **WS**
- Должен быть запрос: `/api/supervisor/unified/stream?sessionId=session-xxx`
- Type: `eventsource`
- Status: `200` (pending во время выполнения)
- Messages: должны приходить в real-time

### Server Logs

Terminal где запущен `npm run dev`:
```
[API /api/supervisor/unified] Request received: { sessionId: 'session-xxx', ... }
[IntelligentSupervisor] Starting execution: ...
[ProgressEmitter] Session session-xxx: started - Начинаю выполнение... (0%)
[ProgressEmitter] Session session-xxx: complexity_assessed - Сложность определена... (20%)
...
[ProgressEmitter] Session session-xxx: completed - Задача выполнена... (100%)
[ProgressEmitter] Cleaned up session session-xxx
[SSE Stream] Stream closed for session: session-xxx
```

---

## Известные проблемы

### TaskProgressIndicator не появляется

**Причины:**
1. sessionId не передан
2. Breadcrumb не содержит sessionId
3. TranscriptContext не извлёк sessionId

**Проверка:**
```javascript
// Browser console:
console.log('[Check] Breadcrumbs:', transcriptItems.filter(i => i.type === 'BREADCRUMB'));
```

Должен быть breadcrumb:
```json
{
  "title": "[Intelligent Supervisor] SSE прогресс доступен",
  "data": {
    "sessionId": "session-xxx",
    "streamUrl": "/api/supervisor/unified/stream?sessionId=session-xxx"
  }
}
```

### Progress bar не обновляется

**Причины:**
1. SSE connection failed
2. IntelligentSupervisor не эмитит events

**Проверка:**
- DevTools → Network → проверить SSE connection
- Server logs → проверить наличие `[ProgressEmitter]` логов

### Connection status всегда 🔴

**Причины:**
1. EventSource не подключился
2. CORS issues
3. SSE endpoint недоступен

**Проверка:**
```bash
# Test SSE endpoint manually:
curl -N http://localhost:3000/api/supervisor/unified/stream?sessionId=test-session
```

Должны приходить SSE messages:
```
data: {"type":"connected","message":"Connected to progress stream",...}

: keep-alive

: keep-alive
```

---

## Полезные команды

### Проверить build

```bash
npm run build
```

### Проверить TypeScript

```bash
npx tsc --noEmit
```

### Проверить linting

```bash
npm run lint
```

---

## Feedback

После тестирования заполните:

### Работает ли?

- [ ] TaskProgressIndicator появляется автоматически
- [ ] Progress bar обновляется в real-time
- [ ] Messages корректные и понятные
- [ ] Connection status работает
- [ ] Collapsible details функционируют
- [ ] Component исчезает после завершения

### Что можно улучшить?

- Визуальный дизайн (цвета, размеры, шрифты)
- Расположение (sticky, fixed, inline)
- Анимации (fade in/out, progress bar)
- Сообщения (более понятные, короче, длиннее)
- Детали (формат, показывать по умолчанию)

### Нашли bug?

1. Описание проблемы
2. Шаги для воспроизведения
3. Ожидаемое поведение
4. Фактическое поведение
5. Browser console logs
6. Server logs
7. Screenshots (если визуальная проблема)

---

*Guide создан: 2025-10-23*
