# Phase 2 Progress Tracking - Debug Instructions

**Дата:** 2025-10-23
**Цель:** Диагностировать почему прогресс-индикатор не отображается в UI

---

## Что было добавлено

В [Transcript.tsx](../src/app/components/Transcript.tsx#L108-L113) добавлен **желтый DEBUG-панель** в верхней части transcript:

```tsx
{/* DEBUG: Active Session ID Display */}
<div className="bg-yellow-100 border border-yellow-400 rounded-md p-3 text-xs font-mono">
  <div className="font-bold mb-1">🔍 DEBUG INFO:</div>
  <div>activeSessionId: {activeSessionId || '(null)'}</div>
  <div>Status: {activeSessionId ? '✅ Ready to show progress' : '❌ No active session'}</div>
</div>
```

Эта панель покажет:
- ✅ Текущее значение `activeSessionId`
- ✅ Статус готовности к отображению прогресса

---

## Шаги для диагностики

### 1. Запустить dev server

Dev server уже запущен на: **http://localhost:3000**

Если нет, выполни:
```bash
npm run dev
```

### 2. Открыть приложение в браузере

1. Открой **http://localhost:3000**
2. Открой **Browser Console** (F12 → Console tab)
3. Выбери сценарий **"Severstal Assistant"** в Scenario dropdown

### 3. Проверить DEBUG-панель ДО выполнения задачи

В левой панели (Transcript) должна появиться **желтая панель** с текстом:

```
🔍 DEBUG INFO:
activeSessionId: (null)
Status: ❌ No active session
```

### 4. Выполнить тестовую задачу

**Голосом или текстом** выполни команду:

```
Прочитай письмо от Анны и назначь встречу
```

ИЛИ любую другую сложную задачу, например:

```
Найди свободное время завтра и создай встречу с Петром
```

### 5. Наблюдать за изменениями

#### В Browser Console должны появиться логи:

**Шаг 1: Breadcrumb создан**
```
[TranscriptContext] Auto-detected sessionId: session-1729712468123-abc123
```

**Шаг 2: activeSessionId изменился**
```
[Transcript] activeSessionId changed: session-1729712468123-abc123
```

**Шаг 3: TaskProgressIndicator рендерится**
```
[Transcript] Rendering TaskProgressIndicator with sessionId: session-1729712468123-abc123
```

**Шаг 4: SSE подключение**
```
[TaskProgressIndicator] Connecting to SSE stream: /api/supervisor/unified/stream?sessionId=session-1729712468123-abc123
[TaskProgressIndicator] SSE connected
```

**Шаг 5: Прогресс-обновления**
```
[TaskProgressIndicator] Progress update: started - Задача получена (0%)
[TaskProgressIndicator] Progress update: complexity_assessed - Сложность оценена (20%)
[TaskProgressIndicator] Progress update: step_started - Выполняется шаг 1/3 (40%)
...
[TaskProgressIndicator] Progress update: completed - Задача завершена (100%)
```

#### В UI должно появиться:

1. **DEBUG-панель** обновится:
   ```
   🔍 DEBUG INFO:
   activeSessionId: session-1729712468123-abc123
   Status: ✅ Ready to show progress
   ```

2. **Под DEBUG-панелью** должен появиться **Progress Indicator**:
   ```
   📊 Task Progress: Выполняется шаг 1/3
   [████████░░░░░░░░░░] 40%
   ▼ Connection: Connected | Show History
   ```

3. **Прогресс-бар** должен обновляться в реальном времени: 0% → 20% → 40% → ... → 100%

---

## Диагностика проблем

### Проблема 1: DEBUG-панель показывает `(null)` даже после выполнения задачи

**Причина:** activeSessionId не устанавливается в TranscriptContext

**Что проверить в console logs:**

❌ **Если НЕТ лога** `[TranscriptContext] Auto-detected sessionId: ...`:
- Breadcrumb не создается
- Проверь, что задача вызывает `intelligentSupervisorTool`
- Проверь server logs на наличие `[intelligentSupervisorTool] Tool execute called`

❌ **Если ЕСТЬ лог** `[TranscriptContext] Auto-detected sessionId: ...`, **НО** `activeSessionId` все равно `(null)`:
- Проблема в React state management
- Возможно, TranscriptContext не обновляется
- Проверь, что `setActiveSessionId` вызывается

---

### Проблема 2: activeSessionId установлен, но TaskProgressIndicator не появляется

**Что проверить в console logs:**

❌ **Если НЕТ лога** `[Transcript] Rendering TaskProgressIndicator...`:
- Conditional rendering не срабатывает
- Проверь, что `activeSessionId` действительно truthy
- DEBUG-панель должна показывать ID

✅ **Если ЕСТЬ лог** `[Transcript] Rendering TaskProgressIndicator...`, **НО** компонент не виден:
- Компонент рендерится, но возможно CSS скрывает его
- Или SSE подключение не устанавливается
- Проверь следующие логи от TaskProgressIndicator

---

### Проблема 3: TaskProgressIndicator рендерится, но не показывает прогресс

**Что проверить в console logs:**

❌ **Если НЕТ лога** `[TaskProgressIndicator] Connecting to SSE stream...`:
- useTaskProgress hook не запускается
- Проверь, что sessionId передается в props

❌ **Если ЕСТЬ лог** `Connecting...`, **НО НЕТ** `SSE connected`:
- SSE endpoint не отвечает или возвращает ошибку
- Проверь Network tab (F12 → Network) для запроса к `/api/supervisor/unified/stream`
- Должен быть тип `eventsource`, статус `200`, тип `text/event-stream`

❌ **Если SSE connected**, **НО НЕТ** прогресс-обновлений:
- IntelligentSupervisor не emit'ит прогресс
- Проверь server logs (terminal где запущен `npm run dev`)
- Должны быть логи `[ProgressEmitter] Session ...: started - ... (0%)`

---

## Что отправить для дальнейшей диагностики

Пожалуйста, предоставь:

### 1. Screenshot DEBUG-панели после выполнения задачи

Желтая панель в верхней части Transcript с `activeSessionId: ...`

### 2. Browser Console logs

Скопируй ВСЕ логи, начиная с момента выполнения задачи, включая:
- `[TranscriptContext] ...`
- `[Transcript] ...`
- `[TaskProgressIndicator] ...`
- Любые ошибки (красным)

### 3. Server logs (terminal)

Скопируй логи из терминала, где запущен `npm run dev`, включая:
- `[intelligentSupervisorTool] ...`
- `[IntelligentSupervisor] ...`
- `[ProgressEmitter] ...`
- `[SSE Stream] ...`

### 4. Network tab (опционально)

Если SSE не подключается:
- F12 → Network tab
- Фильтр: `stream`
- Найди запрос к `/api/supervisor/unified/stream?sessionId=...`
- Screenshot с Headers, Preview, Response

---

## Ожидаемое поведение (SUCCESS CASE)

### Browser Console:
```
[TranscriptContext] Auto-detected sessionId: session-1729712468123-abc123
[Transcript] activeSessionId changed: session-1729712468123-abc123
[Transcript] Rendering TaskProgressIndicator with sessionId: session-1729712468123-abc123
[TaskProgressIndicator] Connecting to SSE stream: /api/supervisor/unified/stream?sessionId=session-1729712468123-abc123
[TaskProgressIndicator] SSE connected
[TaskProgressIndicator] Progress update: started - Задача получена (0%)
[TaskProgressIndicator] Progress update: complexity_assessed - Сложность оценена (20%)
[TaskProgressIndicator] Progress update: step_completed - Шаг завершен (60%)
[TaskProgressIndicator] Progress update: completed - Задача завершена (100%)
[TaskProgressIndicator] Task completed
```

### Server logs:
```
[intelligentSupervisorTool] Tool execute called
[IntelligentSupervisor] Initializing with sessionId: session-1729712468123-abc123
[ProgressEmitter] Session session-1729712468123-abc123: started - Задача получена (0%)
[ProgressEmitter] Session session-1729712468123-abc123: complexity_assessed - Сложность оценена (20%)
[ProgressEmitter] Session session-1729712468123-abc123: completed - Задача завершена (100%)
[SSE Stream] Client connected for session: session-1729712468123-abc123
[SSE Stream] Stream closed for session: session-1729712468123-abc123
```

### UI:
- DEBUG-панель: `activeSessionId: session-1729712468123-abc123 | Status: ✅ Ready to show progress`
- Progress bar: `[████████████████████] 100%`
- История обновлений: видна при клике "Show History"

---

## Следующие шаги после диагностики

После получения логов и screenshots, будет ясно, на каком этапе происходит сбой:

1. **Breadcrumb не создается** → Проблема в intelligentSupervisorTool
2. **Breadcrumb есть, но activeSessionId null** → Проблема в TranscriptContext
3. **activeSessionId есть, но компонент не рендерится** → Проблема в Transcript.tsx
4. **Компонент рендерится, но SSE не подключается** → Проблема в SSE endpoint
5. **SSE подключается, но прогресс не приходит** → Проблема в IntelligentSupervisor

---

**Готово к тестированию!** 🚀

Dev server запущен: http://localhost:3000

Открой браузер, выполни тестовую задачу, и отправь логи.
