# Progress Tracking - SSE Implementation

**Version:** 1.0
**Date:** 2025-10-24

---

## Overview

IntelligentSupervisor использует **Server-Sent Events (SSE)** для real-time прогресс-трекинга выполнения задач. Каждая задача получает уникальный `sessionId`, который используется для маршрутизации событий прогресса к правильному клиенту.

**Key Files:**
- [progressEmitter.ts](../../../src/app/api/supervisor/unified/progressEmitter.ts) — EventEmitter singleton
- [intelligentSupervisor.ts:99-117](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts) — Progress emission logic
- [intelligentSupervisorTool.ts:118-124](../../../src/app/agentConfigs/severstalAssistantAgent/tools/intelligentSupervisorTool.ts) — SessionId generation

---

## Architecture

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Tool generates sessionId                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ intelligentSupervisorTool.ts                                │
│                                                             │
│ const sessionId = `session-${Date.now()}-${random()}`;     │
│                                                             │
│ addTaskProgressMessage(sessionId, taskDescription);         │
│  └─> Creates TASK_PROGRESS component in transcript         │
│                                                             │
│ POST /api/supervisor/unified { sessionId, ... }             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API creates IntelligentSupervisor with sessionId        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ IntelligentSupervisor constructor                           │
│                                                             │
│ this.sessionId = config.sessionId || auto-generate;         │
│ this.config.enableProgressCallbacks = true;                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. IntelligentSupervisor emits progress events             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ IntelligentSupervisor.emitProgress()                        │
│                                                             │
│ private emitProgress(type, message, progress, details?) {   │
│   if (this.config.enableProgressCallbacks && this.sessionId)│
│     progressEmitter.emitProgress({                          │
│       sessionId: this.sessionId,                            │
│       type,                                                 │
│       message,                                              │
│       progress,                                             │
│       details,                                              │
│       timestamp: Date.now()                                 │
│     });                                                     │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ProgressEmitter routes event to sessionId listeners     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ ProgressEmitter (singleton EventEmitter)                    │
│                                                             │
│ emitProgress(update: ProgressUpdate) {                      │
│   this.emit(`progress:${update.sessionId}`, update);       │
│   console.log(`[ProgressEmitter] ${update.type} - ...`);   │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ event: "progress:session-1234-abcd"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SSE endpoint streams events to client                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ GET /api/supervisor/progress/:sessionId                     │
│                                                             │
│ const listener = (update: ProgressUpdate) => {              │
│   res.write(`data: ${JSON.stringify(update)}\n\n`);        │
│ };                                                          │
│ progressEmitter.onProgress(sessionId, listener);            │
│                                                             │
│ req.on('close', () => {                                     │
│   progressEmitter.offProgress(sessionId, listener);         │
│   progressEmitter.cleanupSession(sessionId);                │
│ });                                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ SSE stream: "data: {...}\n\n"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Client (UI) receives events via EventSource             │
└─────────────────────────────────────────────────────────────┘
```

---

## ProgressEmitter Implementation

### Singleton Pattern

```typescript
// progressEmitter.ts

class ProgressEventEmitter extends EventEmitter {
  private static instance: ProgressEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // Support multiple concurrent tasks
  }

  public static getInstance(): ProgressEventEmitter {
    if (!ProgressEventEmitter.instance) {
      ProgressEventEmitter.instance = new ProgressEventEmitter();
    }
    return ProgressEventEmitter.instance;
  }
}

export const progressEmitter = ProgressEventEmitter.getInstance();
```

### Event Methods

```typescript
// Emit progress update
progressEmitter.emitProgress({
  sessionId: 'session-1234-abcd',
  type: 'step_started',
  message: 'Выполняю шаг 1...',
  progress: 40,
  details: { stepNumber: 1 },
  timestamp: Date.now()
});

// Subscribe to session events
progressEmitter.onProgress(sessionId, (update) => {
  console.log(update.message);
});

// Unsubscribe
progressEmitter.offProgress(sessionId, listener);

// Cleanup session (remove all listeners)
progressEmitter.cleanupSession(sessionId);
```

---

## Progress Event Types

### Event Type Enum

```typescript
type ProgressEventType =
  | 'started'              // Task execution started (0%)
  | 'complexity_assessed'  // Complexity assessment completed (20%)
  | 'strategy_selected'    // Execution strategy selected (30%)
  | 'step_started'         // Individual step started (40-70%)
  | 'step_completed'       // Individual step completed (70-90%)
  | 'completed'            // Task fully completed (100%)
  | 'error';               // Error occurred (0%, with details)
```

### ProgressUpdate Interface

```typescript
interface ProgressUpdate {
  sessionId: string;
  type: ProgressEventType;
  message: string;         // User-facing message in Russian
  progress: number;        // 0-100
  currentStep?: number;
  totalSteps?: number;
  details?: any;           // Additional data (strategy, complexity, errors, etc.)
  timestamp: number;
}
```

### Event Timeline Example

```typescript
// DIRECT strategy execution

{ sessionId: 'session-1234', type: 'started', message: 'Начинаю выполнение...', progress: 0, timestamp: 1000 }
{ sessionId: 'session-1234', type: 'complexity_assessed', message: 'Оцениваю сложность...', progress: 10, timestamp: 1500 }
{ sessionId: 'session-1234', type: 'complexity_assessed', message: 'Сложность: simple', progress: 20, details: { complexity: 'simple' }, timestamp: 2000 }
{ sessionId: 'session-1234', type: 'strategy_selected', message: 'Стратегия: direct', progress: 30, details: { strategy: 'direct' }, timestamp: 2200 }
{ sessionId: 'session-1234', type: 'step_started', message: 'Выполняю простую задачу...', progress: 40, timestamp: 2500 }
{ sessionId: 'session-1234', type: 'step_completed', message: 'Простая задача выполнена', progress: 90, timestamp: 3500 }
{ sessionId: 'session-1234', type: 'completed', message: 'Задача выполнена успешно', progress: 100, details: { executionTime: 2500 }, timestamp: 4000 }
```

---

## SessionId Generation

### Tool-side Generation

```typescript
// intelligentSupervisorTool.ts:118-124

const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// Example: "session-1730000000000-abc123"
```

**Format:**
- Prefix: `session-`
- Timestamp: `Date.now()` (milliseconds since epoch)
- Random: 6-char alphanumeric string
- **Uniqueness:** Guaranteed unique within same millisecond + random collision prevention

### TASK_PROGRESS Message Creation

```typescript
// intelligentSupervisorTool.ts:122-124

if (addTaskProgressMessage) {
  addTaskProgressMessage(sessionId, taskDescription);
}
```

**Purpose:**
- Creates a special TASK_PROGRESS component in transcript UI
- Allows UI to subscribe to SSE events for this sessionId
- Displays live progress bar during task execution

---

## SSE Endpoint Implementation

### Route: `/api/supervisor/progress/:sessionId`

```typescript
// src/app/api/supervisor/progress/[sessionId]/route.ts

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  // Set up SSE headers
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Subscribe to progress events
      const listener = (update: ProgressUpdate) => {
        const data = `data: ${JSON.stringify(update)}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Close stream when task completed or error
        if (update.type === 'completed' || update.type === 'error') {
          controller.close();
          progressEmitter.cleanupSession(sessionId);
        }
      };

      progressEmitter.onProgress(sessionId, listener);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        progressEmitter.offProgress(sessionId, listener);
        progressEmitter.cleanupSession(sessionId);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

---

## Client-side Usage

### EventSource Subscription

```typescript
// Client component (React/Next.js)

const [progress, setProgress] = useState(0);
const [status, setStatus] = useState('');

useEffect(() => {
  if (!sessionId) return;

  const eventSource = new EventSource(`/api/supervisor/progress/${sessionId}`);

  eventSource.onmessage = (event) => {
    const update: ProgressUpdate = JSON.parse(event.data);

    setProgress(update.progress);
    setStatus(update.message);

    if (update.type === 'completed') {
      eventSource.close();
    }

    if (update.type === 'error') {
      console.error('Task error:', update.details);
      eventSource.close();
    }
  };

  eventSource.onerror = () => {
    console.error('SSE connection error');
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}, [sessionId]);

return (
  <div>
    <ProgressBar value={progress} />
    <p>{status}</p>
  </div>
);
```

### TASK_PROGRESS Component

```typescript
// Transcript message with TASK_PROGRESS type

{
  type: 'TASK_PROGRESS',
  sessionId: 'session-1234-abcd',
  taskDescription: 'Прочитай письмо от Анны и назначь встречу',
  progress: 0,  // Updated via SSE
  status: 'in_progress'  // 'in_progress' | 'completed' | 'error'
}
```

**UI renders:**
```
┌─────────────────────────────────────────────────────────┐
│ [Intelligent Supervisor]                                │
│                                                         │
│ Задача: Прочитай письмо от Анны и назначь встречу     │
│                                                         │
│ [██████████████████░░░░░░░░] 70%                       │
│ Выполняю шаг 3...                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Progress Mapping

### Strategy-specific Progress Ranges

```typescript
// DIRECT strategy (40-90%)
emitProgress('step_started', 'Выполняю простую задачу...', 40);
emitProgress('step_completed', 'Простая задача выполнена', 90);

// FLAT strategy (40-90%)
emitProgress('step_started', 'Выполняю многошаговую задачу...', 40);
emitProgress('step_completed', 'Многошаговая задача выполнена', 90);

// HIERARCHICAL strategy (40-90%)
// TaskOrchestrator progress (0-100) mapped to (40-90)
const progress = 40 + Math.floor((orchestratorProgress / 100) * 50);
emitProgress('step_started', 'Выполняю подзадачу...', progress);
```

**Fixed progress points:**
- 0%: started
- 10-20%: complexity_assessed
- 30%: strategy_selected
- 40-90%: execution (strategy-dependent)
- 100%: completed

---

## Error Handling

### Error Event

```typescript
try {
  // Execution logic
} catch (error) {
  emitProgress('error', `Ошибка выполнения: ${error.message}`, 0, {
    error: error.message,
    stack: error.stack
  });
  throw error;
}
```

### Client Error Handling

```typescript
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);

  if (update.type === 'error') {
    setStatus(`Ошибка: ${update.message}`);
    setProgress(0);
    eventSource.close();
  }
};
```

---

## Cleanup

### Automatic Cleanup

```typescript
// When task completes
emitProgress('completed', 'Задача выполнена', 100);
// SSE route auto-closes stream and calls:
progressEmitter.cleanupSession(sessionId);

// When client disconnects
req.signal.addEventListener('abort', () => {
  progressEmitter.cleanupSession(sessionId);
});
```

### Manual Cleanup (if needed)

```typescript
// Remove all listeners for a session
progressEmitter.cleanupSession('session-1234-abcd');
```

---

## Performance Considerations

### EventEmitter Capacity

```typescript
this.setMaxListeners(100); // Support 100 concurrent tasks
```

**Trade-off:**
- ✅ Supports many concurrent users
- ⚠️ Memory usage scales with active sessions

### SSE Connection Overhead

| Metric | Value |
|--------|-------|
| Connections per task | 1 SSE connection |
| Bandwidth per event | ~200-500 bytes |
| Events per task | 5-15 (depends on strategy) |
| Total bandwidth | ~1-7 KB per task |

---

## Related Documentation

- [README.md](./README.md) — IntelligentSupervisor overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [progressEmitter.ts](../../../src/app/api/supervisor/unified/progressEmitter.ts) — Full source code

---

**📡 SSE progress tracking provides real-time feedback for all IntelligentSupervisor execution strategies.**
