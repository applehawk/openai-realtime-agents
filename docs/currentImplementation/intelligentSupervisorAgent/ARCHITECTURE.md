# IntelligentSupervisor - Architecture Documentation

**Version:** 1.0
**Date:** 2025-10-24
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Diagram](#component-diagram)
3. [Data Flow](#data-flow)
4. [Strategy Selection Logic](#strategy-selection-logic)
5. [Execution Strategies](#execution-strategies)
6. [Progress Tracking Architecture](#progress-tracking-architecture)
7. [Error Handling](#error-handling)
8. [Performance Considerations](#performance-considerations)

---

## System Overview

IntelligentSupervisor — это **адаптивная система оркестрации задач** с автоматическим выбором стратегии выполнения на основе сложности задачи.

### Core Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│              IntelligentSupervisor Core                     │
├─────────────────────────────────────────────────────────────┤
│ 1. ASSESS    → Evaluate task complexity (simple/medium/    │
│                complex) using supervisorAgent              │
│ 2. SELECT    → Choose execution strategy (direct/flat/     │
│                hierarchical)                                │
│ 3. EXECUTE   → Run task with selected strategy             │
│ 4. TRACK     → Emit progress events via SSE                │
│ 5. RESPOND   → Return unified response format              │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Diagram

### Full System Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────┐     ┌───────────────────────────────┐ │
│  │   RealtimeAgent (UI)     │     │   SSE Client (Progress UI)    │ │
│  │  - User voice/chat input │     │  - Subscribes to sessionId    │ │
│  │  - Tool selection        │     │  - Displays 0-100% progress   │ │
│  │  - Speaks responses      │     │  - Shows current step         │ │
│  └────────┬─────────────────┘     └────────┬──────────────────────┘ │
│           │                                 │                         │
└───────────┼─────────────────────────────────┼─────────────────────────┘
            │                                 │
            │ delegateToIntelligentSupervisor │ GET /api/supervisor/progress/:sessionId
            │                                 │
┌───────────┼─────────────────────────────────┼─────────────────────────┐
│           ▼                  TOOL LAYER     │                         │
├───────────────────────────────────────────────────────────────────────┤
│                                             │                         │
│  ┌────────────────────────────────────────┐ │                         │
│  │ intelligentSupervisorTool.ts           │ │                         │
│  │                                        │ │                         │
│  │ 1. Generate sessionId                  │ │                         │
│  │ 2. Create TASK_PROGRESS message        │ │                         │
│  │ 3. Call POST /api/supervisor/unified   │─┼─────┐                   │
│  │ 4. Add breadcrumbs for workflowSteps  │ │     │                   │
│  └────────────────────────────────────────┘ │     │                   │
│                                             │     │                   │
└─────────────────────────────────────────────┼─────┼───────────────────┘
                                              │     │
                                              │     │ HTTP POST with sessionId
┌─────────────────────────────────────────────┼─────┼───────────────────┐
│              API LAYER                      │     ▼                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ unified/route.ts (POST /api/supervisor/unified)                 │ │
│  │                                                                 │ │
│  │ 1. Validate parameters                                          │ │
│  │ 2. Create IntelligentSupervisor({ sessionId })                 │ │
│  │ 3. Call supervisor.execute(request)                            │ │
│  │ 4. Return UnifiedResponse                                       │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ IntelligentSupervisor (intelligentSupervisor.ts)               │ │
│  │                                                                │ │
│  │  execute(request) {                                            │ │
│  │    1. assessComplexity()      ──> supervisorAgent             │ │
│  │    2. selectStrategy()         ──> simple/medium/complex      │ │
│  │    3. switch (strategy) {                                     │ │
│  │         case 'direct':        ──> executeDirectly()           │ │
│  │         case 'flat':          ──> executeFlatWorkflow()       │ │
│  │         case 'hierarchical':  ──> executeHierarchical()       │ │
│  │       }                                                        │ │
│  │    4. emitProgress()          ──> progressEmitter (SSE)       │ │
│  │    5. return UnifiedResponse                                  │ │
│  │  }                                                             │ │
│  └────────┬───────────────────┬───────────────────┬───────────────┘ │
│           │                   │                   │                 │
│           ▼                   ▼                   ▼                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │ DIRECT       │  │ FLAT             │  │ HIERARCHICAL         │ │
│  │ (simple)     │  │ (medium)         │  │ (complex)            │ │
│  │              │  │                  │  │                      │ │
│  │ 1 step       │  │ 2-7 steps        │  │ 8+ steps             │ │
│  │ supervisor   │  │ multi-step       │  │ TaskOrchestrator     │ │
│  │ executes     │  │ workflow         │  │ recursive breakdown  │ │
│  └──────────────┘  └──────────────────┘  └──────┬───────────────┘ │
│                                                  │                 │
└──────────────────────────────────────────────────┼─────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TASK DECOMPOSITION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ TaskOrchestrator (taskOrchestrator.ts)                         │ │
│  │                                                                │ │
│  │  executeComplexTask() {                                        │ │
│  │    1. Create root task                                         │ │
│  │    2. breakdownTask() recursively  ──> supervisorAgent        │ │
│  │    3. calculateExecutionOrder()    ──> depth-first + deps     │ │
│  │    4. executeTasks() sequentially  ──> supervisorAgent        │ │
│  │    5. collectResults() hierarchically                          │ │
│  │    6. generateReport()             ──> supervisorAgent        │ │
│  │  }                                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Task Tree Structure:                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ task-root (complex)                                           │ │
│  │   ├─ task-root.0 (moderate)                                   │ │
│  │   │   ├─ task-root.0.0 (simple) ✓                            │ │
│  │   │   └─ task-root.0.1 (simple) ✓                            │ │
│  │   ├─ task-root.1 (simple) ✓                                  │ │
│  │   └─ task-root.2 (complex)                                    │ │
│  │       ├─ task-root.2.0 (simple) ✓                            │ │
│  │       └─ task-root.2.1 (simple) ✓                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         AI AGENT LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ SupervisorAgent (agent.ts) - GPT-4o                            │ │
│  │                                                                │ │
│  │ Instructions: supervisorAgentInstructions (551 lines)          │ │
│  │                                                                │ │
│  │ Used by:                                                       │ │
│  │  - assessComplexity()           (complexity assessment)        │ │
│  │  - executeDirectly()            (simple tasks)                 │ │
│  │  - executeFlatWorkflow()        (medium tasks)                 │ │
│  │  - breakdownTaskWithSupervisor() (hierarchical breakdown)     │ │
│  │  - executeSingleTaskWithAgent()  (hierarchical execution)      │ │
│  │  - generateReportWithSupervisor() (hierarchical report)        │ │
│  │                                                                │ │
│  │ Tools:                                                         │ │
│  │  - hostedMcpTool (calendar/email operations)                  │ │
│  │  - RAG MCP (knowledge retrieval)                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        PROGRESS LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ProgressEmitter (progressEmitter.ts) - EventEmitter singleton  │ │
│  │                                                                │ │
│  │ emitProgress(update: ProgressUpdate) {                         │ │
│  │   this.emit(`progress:${sessionId}`, update)                  │ │
│  │ }                                                              │ │
│  │                                                                │ │
│  │ Progress Events:                                               │ │
│  │  - started              (0%)                                   │ │
│  │  - complexity_assessed  (20%)                                  │ │
│  │  - strategy_selected    (30%)                                  │ │
│  │  - step_started         (40-70%)                               │ │
│  │  - step_completed       (70-90%)                               │ │
│  │  - completed            (100%)                                 │ │
│  │  - error                (0% with error details)                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  SSE Route: /api/supervisor/progress/:sessionId                     │
│  │                                                                  │
│  └─> EventSource client subscribes to session-specific events       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### End-to-End Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Request                                                │
└─────────────────────────────────────────────────────────────────────┘
User: "Прочитай письмо от Анны и назначь встречу на предложенное время"
  │
  ▼
RealtimeAgent detects complexity (2+ steps)
  │
  ▼
delegateToIntelligentSupervisor({
  taskDescription: "...",
  conversationContext: "..."
})

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Tool Execution                                              │
└─────────────────────────────────────────────────────────────────────┘
intelligentSupervisorTool.execute()
  │
  ├─> Generate sessionId = "session-1234-abcd"
  │
  ├─> addTaskProgressMessage(sessionId, taskDescription)
  │   └─> Creates TASK_PROGRESS component in transcript
  │
  └─> POST /api/supervisor/unified
      Body: {
        taskDescription,
        conversationContext,
        executionMode: "auto",
        sessionId: "session-1234-abcd"
      }

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: API Handling                                                │
└─────────────────────────────────────────────────────────────────────┘
unified/route.ts
  │
  ├─> Validate parameters
  │
  ├─> Create supervisor = new IntelligentSupervisor({
  │     sessionId: "session-1234-abcd",
  │     maxComplexity: "hierarchical"
  │   })
  │
  └─> result = supervisor.execute(request)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Complexity Assessment                                       │
└─────────────────────────────────────────────────────────────────────┘
IntelligentSupervisor.execute()
  │
  ├─> emitProgress('started', 'Начинаю выполнение...', 0%)
  │
  ├─> assessComplexity(taskDescription, conversationContext)
  │   │
  │   └─> Prompt to supervisorAgent:
  │       "Оцени сложность задачи: ..."
  │       Response: {
  │         complexity: "medium",
  │         reasoning: "2-7 шагов, координация нужна"
  │       }
  │
  └─> emitProgress('complexity_assessed', 'Сложность: medium', 20%)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Strategy Selection                                          │
└─────────────────────────────────────────────────────────────────────┘
selectStrategy(complexity = "medium")
  │
  ├─> if (complexity === "simple")   → strategy = "direct"
  ├─> if (complexity === "medium")   → strategy = "flat"
  └─> if (complexity === "complex")  → strategy = "hierarchical"
  │
  ├─> Selected: strategy = "flat"
  │
  └─> emitProgress('strategy_selected', 'Стратегия: flat', 30%)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: Execution (FLAT Strategy)                                   │
└─────────────────────────────────────────────────────────────────────┘
executeFlatWorkflow(request)
  │
  ├─> emitProgress('step_started', 'Выполняю многошаговую задачу...', 40%)
  │
  ├─> Prompt to supervisorAgent:
  │   "Выполни задачу средней сложности: ..."
  │   "Верни JSON: { nextResponse, workflowSteps }"
  │
  ├─> SupervisorAgent executes:
  │   │
  │   ├─> Step 1: Read email from Anna (Calendar MCP)
  │   ├─> Step 2: Extract meeting time from content
  │   ├─> Step 3: Check calendar for conflicts (Calendar MCP)
  │   └─> Step 4: Create calendar event (Calendar MCP)
  │
  └─> Response from supervisorAgent:
      {
        "nextResponse": "Я прочитал письмо от Анны...",
        "workflowSteps": [
          "Прочитал письмо от Анны от 22 января 10:30",
          "Извлёк время встречи: среда 15 января 15:00",
          "Проверил календарь — свободно",
          "Создал событие в календаре: среда 15:00-16:00"
        ]
      }
  │
  └─> emitProgress('step_completed', 'Задача выполнена (4 шага)', 90%)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: Response Building                                           │
└─────────────────────────────────────────────────────────────────────┘
IntelligentSupervisor.execute() returns:
{
  strategy: "flat",
  complexity: "medium",
  nextResponse: "Я прочитал письмо от Анны...",
  workflowSteps: [ ... ],
  progress: { current: 4, total: 4 },
  executionTime: 2350
}
  │
  └─> emitProgress('completed', 'Задача выполнена', 100%)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: Tool Result Processing                                      │
└─────────────────────────────────────────────────────────────────────┘
intelligentSupervisorTool receives result
  │
  ├─> addBreadcrumb('[Intelligent Supervisor] Выполнение завершено')
  │
  ├─> For each workflowStep:
  │     addBreadcrumb('[Intelligent Supervisor] Шаг 1/4', { step })
  │
  └─> Return to RealtimeAgent:
      {
        success: true,
        strategy: "flat",
        complexity: "medium",
        nextResponse: "...",
        workflowSteps: [ ... ]
      }

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: User Response                                               │
└─────────────────────────────────────────────────────────────────────┘
RealtimeAgent receives tool result
  │
  └─> Speaks nextResponse to user:
      "Я прочитал письмо от Анны, отправленное сегодня утром.
       Она предлагает встречу в среду, пятнадцатого января..."
```

---

## Strategy Selection Logic

### Decision Tree

```
┌───────────────────────────────────────────────────────────────┐
│ assessComplexity(task, context)                               │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ SupervisorAgent      │
              │ Analyzes task with:  │
              │ - Step count         │
              │ - Data sources       │
              │ - Coordination needs │
              │ - Conditional logic  │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ Complexity Assessment Result       │
         └────┬──────────┬──────────┬─────────┘
              │          │          │
     ┌────────▼────┐  ┌──▼────┐  ┌─▼──────────┐
     │   SIMPLE    │  │MEDIUM │  │  COMPLEX   │
     │             │  │       │  │            │
     │ 1 step      │  │2-7    │  │ 8+ steps   │
     │ Clear params│  │steps  │  │ Multiple   │
     │ No logic    │  │Coord  │  │ sources    │
     └────────┬────┘  └──┬────┘  └─┬──────────┘
              │          │          │
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌──────────────┐
         │ DIRECT │ │  FLAT  │ │ HIERARCHICAL │
         │Strategy│ │Strategy│ │  Strategy    │
         └────────┘ └────────┘ └──────────────┘
```

### Complexity Criteria

```typescript
// assessComplexity() prompt to supervisorAgent:

**simple** (1 step):
  ✅ Single action with clear parameters
  ✅ No conditional logic needed
  ✅ No cross-referencing
  ❌ Examples:
     - "Прочитай последнее письмо"
     - "Покажи встречи на завтра"

**medium** (2-7 steps):
  ✅ Multiple sequential steps with dependencies
  ✅ May require conditional logic
  ✅ Coordination between steps needed
  ❌ Examples:
     - "Прочитай письмо от Анны и назначь встречу"
     - "Найди свободное время и создай событие"

**complex** (8+ steps):
  ✅ Many steps (8+)
  ✅ Multiple data sources
  ✅ Mass operations (many people, events)
  ✅ Requires hierarchical decomposition
  ❌ Examples:
     - "Найди всех участников проекта и отправь приглашения"
     - "Проанализируй переписку за месяц"
```

---

## Execution Strategies

### Strategy 1: DIRECT (Simple Tasks)

```
┌───────────────────────────────────────────────────────────────┐
│ executeDirectly(request)                                      │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Prompt to SupervisorAgent:                                  │
│ "Выполни простую задачу: [task]"                           │
│ "Верни JSON: { nextResponse, workflowSteps }"              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ SupervisorAgent│
         │ executes with  │
         │ 1 MCP tool call│
         └───────┬────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ Result:                                                    │
│ {                                                          │
│   "nextResponse": "Последнее письмо от Игоря о встрече...",│
│   "workflowSteps": ["Прочитал последнее письмо"]          │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- ✅ Fast (1 supervisorAgent call)
- ✅ Low latency
- ✅ Suitable for straightforward tasks

### Strategy 2: FLAT (Medium Tasks)

```
┌───────────────────────────────────────────────────────────────┐
│ executeFlatWorkflow(request)                                  │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Prompt to SupervisorAgent:                                  │
│ "Выполни многошаговую задачу: [task]"                      │
│ "Верни JSON: { nextResponse, workflowSteps }"              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────────┐
         │ SupervisorAgent    │
         │ executes workflow: │
         │                    │
         │ Step 1: Tool call  │
         │ Step 2: Tool call  │
         │ Step 3: Logic      │
         │ Step 4: Tool call  │
         └───────┬────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ Result:                                                    │
│ {                                                          │
│   "nextResponse": "Я прочитал письмо от Анны... (80 слов)",│
│   "workflowSteps": [                                       │
│     "Прочитал письмо от Анны",                            │
│     "Извлёк время встречи",                               │
│     "Проверил календарь",                                 │
│     "Создал событие"                                      │
│   ]                                                        │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- ✅ Sequential tool calls with coordination
- ✅ Conditional logic supported
- ✅ Detailed nextResponse (40-100+ words)
- ✅ workflowSteps always included

### Strategy 3: HIERARCHICAL (Complex Tasks)

```
┌───────────────────────────────────────────────────────────────┐
│ executeHierarchical(request)                                  │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Create TaskOrchestrator with config:                        │
│ - maxNestingLevel: 5                                        │
│ - maxSubtasksPerTask: 10                                    │
│ - enableProgressCallbacks: true                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ TaskOrchestrator.executeComplexTask()                       │
│                                                             │
│ Phase 1: BREAKDOWN                                          │
│   ├─> Root task: "Организовать встречу"                   │
│   ├─> breakdownTaskWithSupervisor(root)                   │
│   │   └─> Returns: [Subtask 1, Subtask 2, Subtask 3]     │
│   ├─> Recursively breakdown complex subtasks               │
│   └─> Build Task Tree                                      │
│                                                             │
│ Phase 2: EXECUTION                                          │
│   ├─> Calculate execution order (depth-first, deps)        │
│   ├─> For each leaf task:                                  │
│   │   └─> executeSingleTaskWithAgent(task)                │
│   └─> Update task status (completed/failed)                │
│                                                             │
│ Phase 3: COLLECTION                                         │
│   ├─> Collect results hierarchically (bottom-up)           │
│   ├─> Parent tasks aggregate subtask results               │
│   └─> Build hierarchicalBreakdown                          │
│                                                             │
│ Phase 4: REPORTING                                          │
│   └─> generateReportWithSupervisor(taskTree)              │
│       └─> Returns: FinalReport                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│ FinalReport:                                               │
│ {                                                          │
│   "summary": "Я организовал встречу... (2-3 sentences)",  │
│   "detailedResults": "Нашёл 6 участников... (100+ words)",│
│   "tasksCompleted": 7,                                     │
│   "tasksFailed": 0,                                        │
│   "executionTime": 12500,                                  │
│   "hierarchicalBreakdown": { taskTree }                   │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

**Characteristics:**
- ✅ Recursive breakdown (up to 5 levels)
- ✅ Dependency management
- ✅ Parallel execution potential (future)
- ✅ Detailed hierarchical structure
- ⚠️ Slower (multiple supervisorAgent calls)

---

## Progress Tracking Architecture

### SSE Event Flow

```
┌──────────────────────────────────────────────────────────────┐
│ IntelligentSupervisor.execute()                              │
│ (sessionId = "session-1234-abcd")                            │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ emitProgress()
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ ProgressEmitter (singleton EventEmitter)                     │
│                                                              │
│ emitProgress(update: ProgressUpdate) {                       │
│   this.emit(`progress:${sessionId}`, update)                │
│ }                                                            │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ event: "progress:session-1234-abcd"
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ SSE Route: /api/supervisor/progress/:sessionId               │
│                                                              │
│ GET /api/supervisor/progress/session-1234-abcd               │
│                                                              │
│ const listener = (update) => {                               │
│   res.write(`data: ${JSON.stringify(update)}\n\n`)          │
│ }                                                            │
│ progressEmitter.onProgress(sessionId, listener)              │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ SSE stream
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Client (UI) - EventSource                                    │
│                                                              │
│ const eventSource = new EventSource(                         │
│   `/api/supervisor/progress/${sessionId}`                   │
│ )                                                            │
│                                                              │
│ eventSource.onmessage = (event) => {                         │
│   const update = JSON.parse(event.data)                     │
│   updateProgressUI(update.progress, update.message)          │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

### Progress Event Timeline

```
Time  Progress  Event Type           Message
─────────────────────────────────────────────────────────────
0ms    0%      started              "Начинаю выполнение..."
500ms  10%     complexity_assessed  "Оцениваю сложность..."
1000ms 20%     complexity_assessed  "Сложность: medium"
1200ms 30%     strategy_selected    "Стратегия: flat"
1500ms 40%     step_started         "Выполняю шаг 1..."
2000ms 60%     step_started         "Выполняю шаг 2..."
2500ms 80%     step_started         "Выполняю шаг 3..."
3000ms 90%     step_completed       "Задача выполнена (4 шага)"
3200ms 100%    completed            "Задача выполнена успешно"
```

**See:** [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) for implementation details.

---

## Error Handling

### Error Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Any execution method throws error                            │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ try/catch block │
               │ in execute()    │
               └────────┬─────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │ emitProgress('error', ...)   │
         │ - type: 'error'              │
         │ - progress: 0                │
         │ - details: { error }         │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │ Return error response:       │
         │ {                            │
         │   success: false,            │
         │   error: error.message,      │
         │   fallbackResponse: "..."    │
         │ }                            │
         └──────────────────────────────┘
```

### Error Types

| Error Source | Handling Strategy | User Impact |
|--------------|-------------------|-------------|
| Complexity assessment fails | Default to `medium` | Minimal — uses fallback |
| SupervisorAgent timeout | Throw error, emit SSE | Error message shown |
| Tool call fails (MCP) | SupervisorAgent retries | Task marked as failed |
| TaskOrchestrator breakdown fails | Return partial results | Some subtasks incomplete |
| JSON parse error | Fallback response | Generic error message |

---

## Performance Considerations

### Latency Comparison

| Strategy | Complexity | Avg Time | SupervisorAgent Calls | MCP Calls |
|----------|------------|----------|----------------------|-----------|
| DIRECT | simple | 1-2s | 1 | 1 |
| FLAT | medium | 2-5s | 1 | 2-7 |
| HIERARCHICAL | complex | 10-30s | 5-20 | 8+ |

### Optimization Strategies

1. **Caching complexity assessments** (future)
   - Cache assessment results for similar tasks
   - Reduce supervisorAgent calls

2. **Parallel execution** (future)
   - Execute independent subtasks concurrently
   - Reduce hierarchical execution time

3. **Streaming responses** (partial)
   - SSE progress events provide real-time feedback
   - User perceives lower latency

4. **Task prioritization** (future)
   - Critical tasks execute first
   - Non-critical tasks can be skipped on errors

---

## Related Documentation

- [README.md](./README.md) — Overview and integration guide
- [SUPERVISOR_PROMPT_GUIDE.md](./SUPERVISOR_PROMPT_GUIDE.md) — Prompt engineering details
- [TASK_ORCHESTRATOR_INTEGRATION.md](./TASK_ORCHESTRATOR_INTEGRATION.md) — Hierarchical execution
- [PROGRESS_TRACKING.md](./PROGRESS_TRACKING.md) — SSE implementation

---

**🎯 Architecture designed for adaptive, scalable task execution with automatic complexity detection.**
