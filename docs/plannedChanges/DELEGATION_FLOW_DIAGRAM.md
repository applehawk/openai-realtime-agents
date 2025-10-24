# Визуализация потоков делегирования

## Текущая архитектура (Path 4 vs Path 5)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Router Agent                                │
│                     (gpt-4o-realtime-mini)                           │
└────────────────┬────────────────────────────────┬────────────────────┘
                 │                                │
                 │ 2-7 шагов                     │ 8+ шагов
                 │                                │
    ┌────────────▼────────────┐      ┌───────────▼────────────┐
    │   Path 4: Planning      │      │  Path 5: Complex Task  │
    │  delegateToSupervisor   │      │  executeComplexTask    │
    └────────────┬────────────┘      └───────────┬────────────┘
                 │                                │
                 │                                │
    ┌────────────▼────────────┐      ┌───────────▼────────────┐
    │  /api/supervisor        │      │  /api/tasks/execute    │
    │  ┌─────────────────┐    │      │  ┌──────────────────┐  │
    │  │ supervisorAgent │◄───┼──────┼──┤ TaskOrchestrator │  │
    │  │   (GPT-4o)      │    │      │  └────────┬─────────┘  │
    │  └─────────────────┘    │      │           │            │
    │     │                    │      │           │            │
    │     │ 1 вызов           │      │     N вызовов         │
    │     │                    │      │           │            │
    │     ▼                    │      │           ▼            │
    │  Returns:                │      │  ┌─────────────────┐  │
    │  - nextResponse          │      │  │ supervisorAgent │  │
    │  - workflowSteps?        │      │  │   (GPT-4o)      │  │
    │    (опционально)         │      │  └─────────────────┘  │
    └─────────────────────────┘      │     │       │       │  │
                                      │     │       │       │  │
                                      │  breakdown  exec  report
                                      │     │       │       │  │
                                      │     ▼       ▼       ▼  │
                                      │  Returns:              │
                                      │  - FinalReport         │
                                      │  - hierarchicalBreakdown
                                      │  - workflowSteps       │
                                      └────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ КЛЮЧЕВОЙ ФАКТ: ОБА ПУТИ ИСПОЛЬЗУЮТ ОДИН supervisorAgent (GPT-4o)!  │
│ Path 5 = Path 4 + Orchestration + Hierarchical Breakdown            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Предлагаемая унифицированная архитектура

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Router Agent                                │
│                     (gpt-4o-realtime-mini)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Любая сложная задача
                             │
                ┌────────────▼────────────┐
                │ delegateToSupervisor    │
                │  (unified interface)    │
                └────────────┬────────────┘
                             │
                ┌────────────▼─────────────────────────────────┐
                │   /api/supervisor/unified (новый endpoint)   │
                │  ┌───────────────────────────────────────┐   │
                │  │    IntelligentSupervisor (новый)     │   │
                │  └────────────┬──────────────────────────┘   │
                │               │                              │
                │  Step 1: Complexity Assessment              │
                │       ┌───────▼──────┐                      │
                │       │supervisorAgent│                      │
                │       │   (GPT-4o)    │                      │
                │       └───────┬───────┘                      │
                │               │                              │
                │       Returns: 'simple' | 'medium' | 'complex'
                │               │                              │
                │  Step 2: Strategy Selection ◄───────────────┤
                │       ┌───────▼───────┐                     │
                │       │   Strategy?   │                     │
                │       └───┬───┬───┬───┘                     │
                │           │   │   │                         │
                │  ┌────────┘   │   └──────────┐              │
                │  │            │              │              │
                │  │ Simple     │ Medium       │ Complex      │
                │  │            │              │              │
                │  ▼            ▼              ▼              │
                │ Direct   Flat Workflow  TaskOrchestrator   │
                │  Call       (Path 4)       (Path 5)        │
                │  │            │              │              │
                │  │            │              │              │
                │  └────────────┴──────────────┘              │
                │               │                              │
                │  Step 3: Execute with Progress Tracking     │
                │       ┌───────▼───────┐                     │
                │       │ Progress      │                     │
                │       │ Callbacks     │◄─────────┐          │
                │       └───────┬───────┘          │          │
                │               │                  │          │
                │               │                  │          │
                │               │            Breadcrumbs/     │
                │               │            SSE/WebSocket    │
                │               │                              │
                │  Step 4: Return Unified Response            │
                │       ┌───────▼───────┐                     │
                │       │  Unified      │                     │
                │       │  Response     │                     │
                │       └───────┬───────┘                     │
                └───────────────┼─────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Returns:             │
                    │  - strategy           │
                    │  - nextResponse       │
                    │  - workflowSteps      │
                    │  - hierarchicalBreakdown
                    │  - progress           │
                    │  - executionTime      │
                    └───────────────────────┘
```

---

## Сравнение потоков выполнения

### Пример задачи: "Прочитай письмо от Анны и назначь встречу"

**Path 4 (текущий — delegateToSupervisor):**

```
1. Router Agent → delegateToSupervisor(context, plan, intent, complexity: 'medium')
2. /api/supervisor → supervisorAgent (GPT-4o)
3. supervisorAgent:
   ├─ Читает письмо (MCP: read_email)
   ├─ Извлекает время (parsing)
   ├─ Проверяет календарь (MCP: get_calendar_events)
   ├─ Создаёт событие (MCP: create_event)
   └─ Формирует nextResponse: "Я прочитал письмо от Анны..."
4. Returns: { decision: 'approve', nextResponse, workflowSteps? }
5. Router Agent → озвучивает nextResponse

ВРЕМЯ: ~3-5 секунд
ПРОГРЕСС: ❌ Пользователь не видит промежуточных шагов
GPT-4o ВЫЗОВОВ: 1
```

**Path 5 (текущий — executeComplexTask):**

```
1. Router Agent → executeComplexTask(taskDescription, context)
2. /api/tasks/execute → TaskOrchestrator
3. TaskOrchestrator.executeComplexTask():

   Phase 1: Breakdown
   ├─ supervisorAgent (GPT-4o) → shouldBreakdown? → YES
   ├─ Creates subtasks:
   │  ├─ task-root.0: "Прочитаю письмо от Анны"
   │  ├─ task-root.1: "Извлеку время встречи"
   │  ├─ task-root.2: "Проверю календарь"
   │  └─ task-root.3: "Создам событие"

   Phase 2: Execution
   ├─ supervisorAgent (GPT-4o) → execute task-root.0 → result
   ├─ supervisorAgent (GPT-4o) → execute task-root.1 → result
   ├─ supervisorAgent (GPT-4o) → execute task-root.2 → result
   └─ supervisorAgent (GPT-4o) → execute task-root.3 → result

   Phase 3: Report
   └─ supervisorAgent (GPT-4o) → generate final report

4. Returns: { summary, detailedResults, hierarchicalBreakdown, ... }
5. Router Agent → озвучивает detailedResults

ВРЕМЯ: ~10-20 секунд
ПРОГРЕСС: ✅ Breadcrumbs в UI (если enableProgressCallbacks: true)
GPT-4o ВЫЗОВОВ: 6 (1 breakdown + 4 executions + 1 report)
```

**Unified Approach (предлагаемый):**

```
1. Router Agent → delegateToSupervisor(taskDescription, context)
2. /api/supervisor/unified → IntelligentSupervisor

3. IntelligentSupervisor:

   Phase 1: Complexity Assessment (1 вызов GPT-4o)
   └─ supervisorAgent → complexity: 'medium'

   Phase 2: Strategy Selection
   └─ Strategy: Flat Workflow (как Path 4)

   Phase 3: Execute with Progress
   ├─ supervisorAgent (GPT-4o) выполняет задачу
   ├─ Отправляет breadcrumbs: "Читаю письмо..."
   ├─ Отправляет breadcrumbs: "Проверяю календарь..."
   └─ Отправляет breadcrumbs: "Создаю событие..."

   Phase 4: Return Response
   └─ Returns: { strategy: 'medium', nextResponse, workflowSteps, progress }

4. Router Agent → озвучивает nextResponse

ВРЕМЯ: ~4-7 секунд (complexity assessment добавляет +1-2 сек)
ПРОГРЕСС: ✅ Breadcrumbs в UI + workflowSteps всегда возвращаются
GPT-4o ВЫЗОВОВ: 2 (1 assessment + 1 execution)
```

---

## Ключевые улучшения

```
┌───────────────────────┬──────────────┬──────────────┬──────────────┐
│      Аспект          │   Path 4     │   Path 5     │  Unified     │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ Прогресс-трекинг     │      ❌      │  ✅ (но OFF) │      ✅      │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ Hierarchical         │      ❌      │      ✅      │  Adaptive ✅ │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ workflowSteps        │  Optional ?  │   Always ✅  │   Always ✅  │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ PLAN FIRST mode      │      ✅      │      ❌      │      ✅      │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ Router должен решать │      ✅      │      ✅      │      ❌      │
│ сложность заранее?   │  (2-7 vs 8+) │  (2-7 vs 8+) │   (автомат)  │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ GPT-4o вызовов       │       1      │     5-15     │     2-5      │
│ (типичная задача)    │              │              │   (adaptive) │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ Latency              │   3-5 сек    │  10-20 сек   │   4-12 сек   │
│                      │              │              │  (adaptive)  │
├───────────────────────┼──────────────┼──────────────┼──────────────┤
│ UX for complex tasks │   Средний    │   Хороший    │   Отличный   │
└───────────────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Миграционный путь (visual)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Phase 1                                     │
│                  Backward Compatibility (1-2 недели)                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Router Agent                                                        │
│     ├── delegateToSupervisor (старый)   ──→ /api/supervisor         │
│     ├── executeComplexTask (старый)     ──→ /api/tasks              │
│     └── delegateToIntelligentSupervisor (новый) ──→ /api/supervisor/unified
│                                                         ▲             │
│                                                         │ NEW!        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          Phase 2                                     │
│                  Enable Progress Tracking (1 неделя)                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  /api/supervisor/unified                                             │
│     └── IntelligentSupervisor                                        │
│         └── enableProgressCallbacks: true  ──→ Breadcrumbs/SSE       │
│                                                    ▲                  │
│                                                    │ NEW!             │
│  Frontend subscribes to SSE:                                         │
│     const sse = new EventSource('/api/supervisor/unified?stream=true')
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          Phase 3                                     │
│                     Deprecation (2-3 недели)                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Router Agent (updated)                                              │
│     ├── delegateToSupervisor (deprecated, logs warning)             │
│     ├── executeComplexTask (deprecated, logs warning)               │
│     └── delegateToIntelligentSupervisor ──→ /api/supervisor/unified │
│                           ▲ DEFAULT                                  │
│                                                                      │
│  routerPrompt.ts:                                                    │
│     Path 4 + Path 5 → merged into "delegate to supervisor"          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          Phase 4                                     │
│                        Removal (1 неделя)                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Router Agent (final)                                                │
│     └── delegateToSupervisor ──→ /api/supervisor                     │
│                   ▲ UNIFIED (renamed from delegateToIntelligentSupervisor)
│                                                                      │
│  Removed:                                                            │
│     ❌ /api/supervisor (старый)                                     │
│     ❌ /api/tasks (старый)                                          │
│     ❌ executeComplexTask tool                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

*End of diagram*
