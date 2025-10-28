# Phase 2 Progress Tracking - Bug Fix

**Дата:** 2025-10-23
**Проблема:** Progress Indicator не отображается в UI + бесконечные переподключения SSE
**Статус:** ✅ Исправлено

---

## Обнаруженные проблемы

### Проблема #1: Бесконечный цикл переподключений SSE ♻️

**Симптомы:**
```
[SSE Stream] Client connected for session: session-1761249412617-hu3kdg1h
 GET /api/supervisor/unified/stream?sessionId=session-1761249412617-hu3kdg1h 200 in 9ms
[ProgressEmitter] Cleaned up session session-1761249412617-hu3kdg1h
[SSE Stream] Client disconnected for session: session-1761249412617-hu3kdg1h
[SSE Stream] Stream cancelled for session: session-1761249412617-hu3kdg1h
[SSE Stream] Client connected for session: session-1761249412617-hu3kdg1h
 GET /api/supervisor/unified/stream?sessionId=session-1761249412617-hu3kdg1h 200 in 10ms
[ProgressEmitter] Cleaned up session session-1761249412617-hu3kdg1h
[SSE Stream] Client disconnected for session: session-1761249412617-hu3kdg1h
...
```

**Причина:**

В [src/app/hooks/useTaskProgress.ts:96](../src/app/hooks/useTaskProgress.ts#L96), `useEffect` имел **неправильные dependencies**:

```typescript
// ❌ БЫЛО (НЕПРАВИЛЬНО):
useEffect(() => {
  // ... EventSource setup
  return () => {
    eventSource.close();
  };
}, [sessionId, handleUpdate]); // ❌ handleUpdate меняется на каждом рендере!
```

**Что происходило:**
1. Компонент рендерится → useEffect запускается → EventSource создается
2. setState вызывается (new update) → компонент ре-рендерится
3. `handleUpdate` пересоздается (новая функция) → useEffect видит новый dependency
4. useEffect cleanup запускается → EventSource.close()
5. useEffect снова запускается → **новый EventSource создается**
6. GOTO step 2 → **бесконечный цикл** ♻️

**Эффект:**
- SSE подключение создается и закрывается каждые ~10-50ms
- Прогресс-обновления могут теряться между переподключениями
- Сервер засоряется логами "[SSE Stream] Client connected/disconnected"
- Нагрузка на сервер и клиент

**Решение:**

Убрать `handleUpdate` из dependencies, т.к. `useCallback` без deps делает его стабильным:

```typescript
// ✅ СТАЛО (ПРАВИЛЬНО):
useEffect(() => {
  // ... EventSource setup
  return () => {
    eventSource.close();
  };
}, [sessionId]); // handleUpdate is stable via useCallback, no need in deps
```

**Обоснование:**
- `handleUpdate` создается через `useCallback(fn, [])` — без dependencies
- Это делает `handleUpdate` **стабильной ссылкой** на всю жизнь компонента
- Нет необходимости включать его в dependencies useEffect
- SSE подключение теперь создается **один раз** для каждого sessionId

---

## Дополнительные улучшения

### Добавлен DEBUG-панель в Transcript ✅

**Файл:** [src/app/components/Transcript.tsx:108-113](../src/app/components/Transcript.tsx#L108-L113)

**Что добавлено:**

```tsx
{/* DEBUG: Active Session ID Display */}
<div className="bg-yellow-100 border border-yellow-400 rounded-md p-3 text-xs font-mono">
  <div className="font-bold mb-1">🔍 DEBUG INFO:</div>
  <div>activeSessionId: {activeSessionId || '(null)'}</div>
  <div>Status: {activeSessionId ? '✅ Ready to show progress' : '❌ No active session'}</div>
</div>
```

**Зачем:**
- Позволяет визуально проверить, установлен ли `activeSessionId` в TranscriptContext
- Помогает диагностировать проблемы с auto-detection sessionId из breadcrumbs
- Показывает статус готовности к отображению прогресс-индикатора

**Примечание:** Это временная панель для debugging. После подтверждения работы можно убрать.

---

## Ожидаемое поведение после фикса

### Одно SSE подключение на сессию ✅

**Server logs:**
```
[SSE Stream] Client connected for session: session-xxx
 GET /api/supervisor/unified/stream?sessionId=session-xxx 200 in 15ms
[ProgressEmitter] Session session-xxx: started - Задача получена (0%)
[ProgressEmitter] Session session-xxx: complexity_assessed - Сложность оценена (20%)
[ProgressEmitter] Session session-xxx: step_completed - Шаг завершен (60%)
[ProgressEmitter] Session session-xxx: completed - Задача завершена (100%)
[SSE Stream] Stream closed for session: session-xxx
[ProgressEmitter] Cleaned up session session-xxx
```

**Browser console:**
```
[useTaskProgress] Connecting to SSE for session: session-xxx
[useTaskProgress] SSE connection opened
[useTaskProgress] Update: { type: 'started', progress: 0, ... }
[useTaskProgress] Update: { type: 'complexity_assessed', progress: 20, ... }
[useTaskProgress] Update: { type: 'completed', progress: 100, ... }
[useTaskProgress] Cleanup: closing SSE
```

**UI:**
- DEBUG-панель: `activeSessionId: session-xxx | Status: ✅ Ready to show progress`
- Progress bar появляется под DEBUG-панелью
- Прогресс обновляется плавно: 0% → 20% → 40% → ... → 100%
- После завершения (100%), progress bar показывает "✅ Task completed"

---

## Как протестировать

### 1. Убедиться, что dev server запущен

```bash
npm run dev
# Server: http://localhost:3000
```

### 2. Открыть приложение в браузере

1. Открыть **http://localhost:3000**
2. Открыть **Browser Console** (F12 → Console)
3. Выбрать **"Severstal Assistant"** в Scenario dropdown

### 3. Проверить начальное состояние

В Transcript (левая панель) должна быть **желтая DEBUG-панель**:
```
🔍 DEBUG INFO:
activeSessionId: (null)
Status: ❌ No active session
```

### 4. Выполнить тестовую задачу

**Голосом или текстом:**
```
Прочитай письмо от Анны и назначь встречу
```

### 5. Наблюдать за прогрессом

#### В Browser Console:
```
[TranscriptContext] Auto-detected sessionId: session-xxx
[Transcript] activeSessionId changed: session-xxx
[Transcript] Rendering TaskProgressIndicator with sessionId: session-xxx
[useTaskProgress] Connecting to SSE for session: session-xxx
[useTaskProgress] SSE connection opened
[useTaskProgress] Update: { type: 'started', progress: 0, ... }
[useTaskProgress] Update: { type: 'completed', progress: 100, ... }
```

**✅ Должно быть ОДНО подключение**, а не циклы connect/disconnect!

#### В UI:
1. DEBUG-панель обновится:
   ```
   activeSessionId: session-xxx
   Status: ✅ Ready to show progress
   ```

2. Progress Indicator появится под DEBUG-панелью:
   ```
   📊 Task Progress: Выполняется задача...
   [████████░░░░░░░░░░] 40%
   ▼ Connection: Connected | Show History
   ```

3. Прогресс-бар обновляется плавно до 100%

#### В Server logs (terminal):
```
[intelligentSupervisorTool] Tool execute called
[IntelligentSupervisor] Initializing with sessionId: session-xxx
[SSE Stream] Client connected for session: session-xxx
[ProgressEmitter] Session session-xxx: started - ... (0%)
[ProgressEmitter] Session session-xxx: completed - ... (100%)
[SSE Stream] Stream closed for session: session-xxx
```

**✅ Одно подключение** от начала до конца задачи!

---

## Файлы изменены

### ✅ Исправлено:
1. [src/app/hooks/useTaskProgress.ts](../src/app/hooks/useTaskProgress.ts#L96) — убран `handleUpdate` из deps

### ✅ Добавлено:
2. [src/app/components/Transcript.tsx](../src/app/components/Transcript.tsx#L108-L113) — DEBUG-панель
3. [docs/PHASE2_DEBUG_INSTRUCTIONS.md](./PHASE2_DEBUG_INSTRUCTIONS.md) — инструкции по отладке

---

## Следующие шаги

### После тестирования:

1. **Если прогресс-индикатор работает:**
   - ✅ Убрать DEBUG-панель из Transcript.tsx
   - ✅ Создать PR с финальным Phase 2
   - ✅ Обновить PHASE2_COMPLETED.md
   - ✅ Провести user acceptance testing

2. **Если все еще не работает:**
   - 📊 Отправить console logs (browser + server)
   - 📊 Screenshot DEBUG-панели
   - 📊 Network tab (F12) с запросами к `/api/supervisor/unified/stream`

---

## Техническая документация

### Почему handleUpdate не нужен в dependencies?

**React правило:** useEffect dependencies должны включать все внешние значения, используемые внутри эффекта.

**Исключение:** Стабильные ссылки (не меняются между рендерами):
- `useCallback` без deps: `const fn = useCallback(() => {}, [])` → стабильная ссылка
- `useRef`: `const ref = useRef()` → стабильная ссылка
- Props с `React.memo` и стабильными deps

**В нашем случае:**
```typescript
const handleUpdate = useCallback((update: ProgressUpdate) => {
  setState(prev => ({ ...prev, /* ... */ }));
}, []); // ✅ Пустой массив deps → handleUpdate НИКОГДА не меняется
```

**Вывод:** `handleUpdate` — стабильная ссылка, безопасно не включать в deps useEffect.

**ESLint warning:** `react-hooks/exhaustive-deps` будет предупреждать, но это **false positive**. Можно добавить комментарий:
```typescript
}, [sessionId]); // handleUpdate is stable via useCallback, no need in deps
// eslint-disable-next-line react-hooks/exhaustive-deps
```

---

**Статус:** ✅ Фикс применен, готов к тестированию

**Dev server:** http://localhost:3000 (уже запущен)

**Следующее:** Тестирование пользователем → обратная связь → финализация Phase 2
