# Action Items: Улучшение систем делегирования

**Статус:** Ready for implementation
**Приоритет:** HIGH
**Владелец:** [TBD]

---

## Quick Wins (можно сделать сегодня)

### ✅ QW-1: Включить прогресс-callbacks в Path 5

**Файл:** [src/app/api/tasks/route.ts:55](../src/app/api/tasks/route.ts#L55)

**Изменение:**
```typescript
// BEFORE:
const orchestrator = new TaskOrchestrator(
  {
    maxNestingLevel: 5,
    maxSubtasksPerTask: 10,
    enableProgressCallbacks: false, // ❌ ОТКЛЮЧЕНО
  },
  undefined // No callback
);

// AFTER:
const orchestrator = new TaskOrchestrator(
  {
    maxNestingLevel: 5,
    maxSubtasksPerTask: 10,
    enableProgressCallbacks: true, // ✅ ВКЛЮЧЕНО
  },
  (update) => {
    // Log progress for debugging
    console.log('[TaskProgress]', update.type, update.taskDescription, `${update.progress}%`);

    // TODO (QW-3): Send to UI via SSE/WebSocket
  }
);
```

**Время:** 5 минут
**Тестирование:** Вызвать executeComplexTask и проверить логи
**Эффект:** Прогресс выполнения задач виден в server logs

---

### ✅ QW-2: Сделать workflowSteps обязательными в Path 4

**Файл:** [src/app/api/supervisor/agent.ts:291-306](../src/app/api/supervisor/agent.ts#L291-L306)

**Изменение:**
```typescript
// В supervisorAgentInstructions, секция workflowSteps:

// BEFORE (линия 291):
**workflowSteps field (OPTIONAL, for "approve" decision in EXECUTE IMMEDIATELY mode):**

// AFTER:
**workflowSteps field (REQUIRED, for "approve" decision in EXECUTE IMMEDIATELY mode):**
- This field is REQUIRED when decision is "approve" and you ALREADY EXECUTED multiple steps
- ALWAYS provide workflowSteps for transparency and debugging
- Use this field even for simple 2-step tasks
```

**Время:** 15 минут
**Тестирование:** Вызвать delegateToSupervisor и проверить, что workflowSteps всегда возвращаются
**Эффект:** 100% задач имеют структурированный workflow

---

### ✅ QW-3: Добавить breadcrumb updates в Path 4

**Файл:** [src/app/api/supervisor/route.ts](../src/app/api/supervisor/route.ts)

**Новый код (после строки 69):**
```typescript
// Existing:
const result = await run(supervisorAgent, input);

// ADD breadcrumb support:
const addBreadcrumb = (req as any).addTranscriptBreadcrumb;

// ADD progress tracking callback:
const progressTracker = {
  onToolStart: (toolName: string) => {
    console.log('[Supervisor] Tool started:', toolName);
    if (addBreadcrumb) {
      addBreadcrumb('[Supervisor] Выполняю', { tool: toolName });
    }
  },
  onToolComplete: (toolName: string, result: any) => {
    console.log('[Supervisor] Tool completed:', toolName);
    if (addBreadcrumb) {
      addBreadcrumb('[Supervisor] Завершено', { tool: toolName });
    }
  }
};

// Pass to supervisorAgent context
const result = await run(supervisorAgent, input, { progressTracker });
```

**Время:** 1 час (включая тестирование)
**Тестирование:** Вызвать delegateToSupervisor и проверить breadcrumbs в UI transcript
**Эффект:** Пользователи видят промежуточные шаги в UI

**Примечание:** Требует изменения в SDK `@openai/agents` для поддержки прогресс-callbacks. Альтернатива: обернуть MCP tools в proxy для трекинга.

---

## Phase 1: Backward-compatible унификация (1-2 недели)

### 📋 P1-1: Создать `/api/supervisor/unified` endpoint

**Новый файл:** `src/app/api/supervisor/unified/route.ts`

**Скелет:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { IntelligentSupervisor } from './intelligentSupervisor';

export async function POST(req: NextRequest) {
  const { taskDescription, conversationContext, executionMode, maxComplexity } = await req.json();

  const supervisor = new IntelligentSupervisor({
    enableProgressCallbacks: true,
    maxComplexity: maxComplexity || 'hierarchical',
  });

  const result = await supervisor.execute({
    taskDescription,
    conversationContext,
    executionMode: executionMode || 'auto',
  });

  return NextResponse.json(result);
}
```

**Время:** 3-4 часа
**Зависимости:** P1-2 (IntelligentSupervisor класс)

---

### 📋 P1-2: Реализовать IntelligentSupervisor класс

**Новый файл:** `src/app/api/supervisor/unified/intelligentSupervisor.ts`

**Функциональность:**
1. **Complexity Assessment** — вызов supervisorAgent для оценки сложности
2. **Strategy Selection** — выбор: simple / medium / complex
3. **Execute with Progress** — выполнение с breadcrumbs
4. **Return Unified Response** — структурированный ответ

**Интерфейс:**
```typescript
interface UnifiedRequest {
  taskDescription: string;
  conversationContext: string;
  executionMode?: 'auto' | 'plan' | 'execute';
}

interface UnifiedResponse {
  strategy: 'simple' | 'medium' | 'complex';
  nextResponse: string;
  workflowSteps: string[];
  hierarchicalBreakdown?: any;
  progress: { current: number; total: number };
  executionTime: number;
}

class IntelligentSupervisor {
  async execute(request: UnifiedRequest): Promise<UnifiedResponse>;
}
```

**Время:** 6-8 часов
**Зависимости:** Существующие supervisorAgent и TaskOrchestrator

---

### 📋 P1-3: Добавить новый tool в Router Agent

**Файл:** [src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts](../src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts)

**Изменение:**
```typescript
import { delegateToIntelligentSupervisor } from '../intelligentSupervisorTool'; // NEW

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,
  handoffs: [
    knowledgeAgent,
    interviewAgent,
  ],
  tools: [
    hostedMcpTool({ ... }),
    getCurrentUserInfo,
    checkInterviewStatus,

    // Existing (deprecated)
    delegateToSupervisor,
    executeComplexTask,

    // NEW unified tool
    delegateToIntelligentSupervisor, // ← ADD
  ],
});
```

**Новый файл:** `src/app/agentConfigs/severstalAssistantAgent/intelligentSupervisorTool.ts`

**Скелет:**
```typescript
import { tool } from '@openai/agents/realtime';

export const delegateToIntelligentSupervisor = tool({
  name: 'delegateToIntelligentSupervisor',
  description: 'Delegates complex tasks to unified intelligent supervisor with adaptive complexity',
  parameters: {
    type: 'object',
    properties: {
      taskDescription: { type: 'string', description: 'Полное описание задачи' },
      conversationContext: { type: 'string', description: 'Контекст разговора' },
      executionMode: {
        type: 'string',
        enum: ['auto', 'plan', 'execute'],
        description: 'Режим выполнения (default: auto)',
      },
    },
    required: ['taskDescription', 'conversationContext'],
  },
  execute: async (input, details) => {
    const response = await fetch('/api/supervisor/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    return await response.json();
  },
});
```

**Время:** 2-3 часа

---

### 📋 P1-4: Обновить routerPrompt.ts (добавить unified path)

**Файл:** [src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts](../src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts)

**Изменение (добавить новую секцию после Path 5):**
```typescript
---

### Path 6: Intelligent Supervisor (NEW — рекомендовано)

**Когда использовать:**
✅ Любая сложная задача, требующая множественных шагов
✅ Когда не уверен в сложности (2-7 или 8+)
✅ Хочешь автоматическую оценку и выбор стратегии

**Как работает:**
1. Вызвать delegateToIntelligentSupervisor tool
2. Backend автоматически оценит сложность (simple/medium/complex)
3. Выберет стратегию: flat workflow или hierarchical breakdown
4. Выполнит задачу с прогресс-трекингом
5. Вернёт детальный ответ

**Преимущества перед Path 4/5:**
- ✅ НЕ нужно определять сложность заранее
- ✅ Прогресс-трекинг всегда включён
- ✅ workflowSteps всегда возвращаются
- ✅ Поддерживает PLAN FIRST и EXECUTE IMMEDIATELY modes

**Примеры:**
- «Прочитай письмо от Анны и назначь встречу» → delegateToIntelligentSupervisor
- «Найди всех участников проекта и отправь приглашения» → delegateToIntelligentSupervisor

**Параметры вызова:**
\`\`\`typescript
{
  taskDescription: "Полное описание задачи",
  conversationContext: "Контекст разговора",
  executionMode: 'auto' | 'plan' | 'execute' // Опционально, default: 'auto'
}
\`\`\`

**ВАЖНО:** Это РЕКОМЕНДУЕМЫЙ способ для всех сложных задач (2+ шагов).
Используй вместо Path 4 (delegateToSupervisor) или Path 5 (executeComplexTask).
```

**Время:** 1 час

---

## Phase 2: Enable Progress Tracking (1 неделя)

### 📋 P2-1: Интегрировать SSE endpoint

**Новый файл:** `src/app/api/supervisor/unified/stream/route.ts`

**Скелет:**
```typescript
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send SSE headers
      // Subscribe to progress updates
      // Forward to client
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Время:** 4-5 часов

---

### 📋 P2-2: Frontend подписка на SSE

**Файл:** `src/app/components/TaskProgressIndicator.tsx` (новый компонент)

**Скелет:**
```typescript
export function TaskProgressIndicator() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  useEffect(() => {
    const eventSource = new EventSource('/api/supervisor/unified/stream');

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setProgress(update.progress);
      setCurrentStep(update.currentTask);
    };

    return () => eventSource.close();
  }, []);

  return (
    <div>
      <progress value={progress} max={100} />
      <p>{currentStep}</p>
    </div>
  );
}
```

**Время:** 3-4 часа

---

## Phase 3: Deprecation (2-3 недели)

### 📋 P3-1: Добавить deprecation warnings

**Файлы:**
- `src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts`
- `src/app/agentConfigs/severstalAssistantAgent/executeComplexTaskTool.ts`

**Изменение:**
```typescript
// В execute функции каждого tool:
console.warn('[DEPRECATED] delegateToSupervisor is deprecated. Use delegateToIntelligentSupervisor instead.');

// Добавить в description:
description: '[DEPRECATED] Use delegateToIntelligentSupervisor. Delegates complex tasks...'
```

**Время:** 30 минут

---

### 📋 P3-2: Обновить routerPrompt.ts (миграция на unified)

**Файл:** [src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts](../src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts)

**Изменение (секция Decision Matrix, линия 224-242):**
```typescript
// BEFORE:
Множественные шаги (2-7)? → ДА → Planning Agent (tool)
    ↓ НЕТ
Задача имеет 8+ шагов? → ДА → Complex Task Agent (с подтверждением!)

// AFTER:
Множественные шаги (2+)? → ДА → Intelligent Supervisor (tool)
```

**Время:** 2 часа (включая обновление примеров)

---

### 📋 P3-3: Миграция тестов

**Задача:**
1. Создать тесты для `/api/supervisor/unified`
2. Обновить существующие тесты для backward compatibility
3. Добавить integration tests для всех трёх путей (Path 4, 5, Unified)

**Время:** 1-2 дня

---

## Phase 4: Cleanup (1 неделя)

### 📋 P4-1: Удалить deprecated endpoints

**Удалить файлы:**
- `src/app/api/supervisor/route.ts` (старый Path 4)
- `src/app/api/tasks/route.ts` (старый Path 5)

**Время:** 30 минут

---

### 📋 P4-2: Удалить deprecated tools

**Удалить из routerAgent.ts:**
- `delegateToSupervisor`
- `executeComplexTask`

**Удалить файлы:**
- `src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts`
- `src/app/agentConfigs/severstalAssistantAgent/executeComplexTaskTool.ts`

**Время:** 30 минут

---

### 📋 P4-3: Переименовать unified tool

**Rename:**
- `delegateToIntelligentSupervisor` → `delegateToSupervisor`
- `/api/supervisor/unified` → `/api/supervisor`

**Время:** 1 час

---

### 📋 P4-4: Финальные тесты и документация

**Задача:**
1. Запустить все тесты
2. Обновить README.md
3. Обновить CLAUDE.md с новой архитектурой
4. Создать migration guide для пользователей

**Время:** 1-2 дня

---

## Чек-лист готовности

### Quick Wins
- [ ] QW-1: Включить прогресс-callbacks в Path 5
- [ ] QW-2: Сделать workflowSteps обязательными в Path 4
- [ ] QW-3: Добавить breadcrumb updates в Path 4

### Phase 1
- [ ] P1-1: Создать `/api/supervisor/unified` endpoint
- [ ] P1-2: Реализовать IntelligentSupervisor класс
- [ ] P1-3: Добавить новый tool в Router Agent
- [ ] P1-4: Обновить routerPrompt.ts (добавить unified path)

### Phase 2
- [ ] P2-1: Интегрировать SSE endpoint
- [ ] P2-2: Frontend подписка на SSE

### Phase 3
- [ ] P3-1: Добавить deprecation warnings
- [ ] P3-2: Обновить routerPrompt.ts (миграция на unified)
- [ ] P3-3: Миграция тестов

### Phase 4
- [ ] P4-1: Удалить deprecated endpoints
- [ ] P4-2: Удалить deprecated tools
- [ ] P4-3: Переименовать unified tool
- [ ] P4-4: Финальные тесты и документация

---

## Timeline

```
Week 1: Quick Wins + Phase 1 start
  └─ QW-1, QW-2, QW-3
  └─ P1-1, P1-2

Week 2: Phase 1 completion
  └─ P1-3, P1-4
  └─ Initial testing

Week 3: Phase 2
  └─ P2-1, P2-2
  └─ UI integration

Week 4: Phase 3
  └─ P3-1, P3-2, P3-3
  └─ Deprecation notices

Week 5-6: Phase 4
  └─ P4-1, P4-2, P4-3, P4-4
  └─ Final cleanup and docs
```

**Total:** 5-6 недель (с учётом тестирования и документации)

---

## Контакты для вопросов

**Архитектура:** [TBD]
**Backend:** [TBD]
**Frontend:** [TBD]
**Тестирование:** [TBD]

---

**Связанные документы:**
- [DELEGATION_ANALYSIS.md](./DELEGATION_ANALYSIS.md) — полный анализ
- [DELEGATION_FLOW_DIAGRAM.md](./DELEGATION_FLOW_DIAGRAM.md) — визуализация
- [DELEGATION_EXECUTIVE_SUMMARY.md](./DELEGATION_EXECUTIVE_SUMMARY.md) — executive summary

---

*Последнее обновление: 2025-10-23*
