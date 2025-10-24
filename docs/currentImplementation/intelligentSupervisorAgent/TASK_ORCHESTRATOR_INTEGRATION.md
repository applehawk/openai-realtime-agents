# Task Orchestrator Integration

**Version:** 1.0
**Date:** 2025-10-24

---

## Overview

TaskOrchestrator — это движок иерархического выполнения задач, который используется **IntelligentSupervisor** в стратегии `hierarchical` для очень сложных задач (8+ шагов).

**Files:**
- [taskOrchestrator.ts](../../../src/app/api/supervisor/taskOrchestrator.ts) — Main orchestrator class
- [taskTypes.ts](../../../src/app/api/supervisor/taskTypes.ts) — Task, TaskTree, and response types
- [intelligentSupervisor.ts:444-495](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts) — Integration point

---

## Integration Point

### When TaskOrchestrator is Used

```typescript
// IntelligentSupervisor.executeHierarchical()

if (strategy === 'hierarchical') {
  const orchestrator = new TaskOrchestrator({
    maxNestingLevel: 5,
    maxSubtasksPerTask: 10,
    enableProgressCallbacks: true
  });

  const report = await orchestrator.executeComplexTask(
    taskDescription,
    conversationContext,
    this.breakdownTaskWithSupervisor.bind(this),  // Breakdown function
    this.executeSingleTaskWithAgent.bind(this),   // Execution function
    this.generateReportWithSupervisor.bind(this)  // Report function
  );

  return {
    strategy: 'hierarchical',
    complexity: 'complex',
    nextResponse: report.detailedResults,
    workflowSteps: extractWorkflowStepsFromHierarchy(report.hierarchicalBreakdown),
    hierarchicalBreakdown: report.hierarchicalBreakdown
  };
}
```

---

## Task Breakdown Flow

### Phase 1: Recursive Breakdown

```
Root Task: "Организовать встречу со всеми участниками проекта Восток"
  │
  ▼ breakdownTaskWithSupervisor(root)
  │
┌─┴──────────────────────────────────────────────────────────────┐
│ SupervisorAgent analyzes task:                                 │
│ "Проанализируй задачу и реши, нужно ли разбить её на подзадачи"│
│                                                                 │
│ Returns: {                                                      │
│   shouldBreakdown: true,                                        │
│   reasoning: "Задача сложная, 8+ шагов, нужна декомпозиция",   │
│   subtasks: [                                                   │
│     {                                                           │
│       description: "Найти всех участников проекта",            │
│       estimatedComplexity: "moderate",                          │
│       dependencies: []                                          │
│     },                                                          │
│     {                                                           │
│       description: "Проверить календари участников",           │
│       estimatedComplexity: "simple",                            │
│       dependencies: [0]  // Зависит от задачи 0                │
│     },                                                          │
│     {                                                           │
│       description: "Создать событие и отправить приглашения",  │
│       estimatedComplexity: "moderate",                          │
│       dependencies: [1]                                         │
│     }                                                           │
│   ]                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼ Create subtasks as Task objects
  │
  ├─ task-root.0 (moderate) → breakdown again if needed
  ├─ task-root.1 (simple)   → leaf task (will be executed)
  └─ task-root.2 (moderate) → breakdown again if needed
```

### Phase 2: Execution Order Calculation

```
TaskOrchestrator.calculateExecutionOrder(rootTask)
  │
  ├─> Depth-first traversal
  ├─> Respect dependencies
  └─> Return flat array of leaf task IDs

Result: ["task-root.0.0", "task-root.0.1", "task-root.1", "task-root.2.0"]
```

### Phase 3: Sequential Execution

```
For each taskId in executionOrder:
  │
  ├─> Check dependencies completed
  │
  ├─> executeSingleTaskWithAgent(task)
  │   │
  │   └─> SupervisorAgent executes:
  │       "Выполни следующую задачу: [description]"
  │       Returns: {
  │         status: "completed",
  │         result: "Нашёл 6 участников",
  │         workflowSteps: [...]
  │       }
  │
  └─> Update task.status = "completed"
```

### Phase 4: Hierarchical Result Collection

```
TaskManager.collectResults(rootTask)
  │
  ├─> For each subtask:
  │   └─> Recursively collect results
  │
  └─> Aggregate into parent task

Result:
  task-root.result = "
    1. Найти участников: Нашёл 6 участников
    2. Проверить календари: Проверил календари
    3. Создать событие: Создал событие и отправил приглашения
  "
```

### Phase 5: Final Report Generation

```
generateReportWithSupervisor(taskTree)
  │
  └─> SupervisorAgent:
      "Сгенерируй финальный отчёт о выполнении сложной задачи"

      Returns: {
        summary: "Я организовал встречу со всеми участниками...",
        detailedResults: "Нашёл шесть участников: Иван, Анна... (100+ слов)",
        tasksCompleted: 7,
        tasksFailed: 0,
        executionTime: 12500,
        hierarchicalBreakdown: { taskTree }
      }
```

---

## IntelligentSupervisor Helper Methods

### 1. breakdownTaskWithSupervisor()

**File:** [intelligentSupervisor.ts:570-632](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts)

**Purpose:** Ask SupervisorAgent to break task into subtasks

**Prompt:**
```typescript
`Проанализируй задачу и реши, нужно ли разбить её на подзадачи.

**Задача:** ${task.description}
**Уровень вложенности:** ${task.level}
**Текущая сложность:** ${task.complexity}

**Верни JSON:**
{
  "shouldBreakdown": true/false,
  "reasoning": "...",
  "subtasks": [
    {
      "description": "Подзадача 1 (будущее время)",
      "estimatedComplexity": "simple" | "moderate" | "complex",
      "dependencies": [0]
    }
  ]
}`
```

**Response Type:** `TaskBreakdownResponse`

### 2. executeSingleTaskWithAgent()

**File:** [intelligentSupervisor.ts:637-684](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts)

**Purpose:** Execute one leaf task using SupervisorAgent

**Prompt:**
```typescript
`Выполни следующую задачу:

**Задача:** ${task.description}

${previousResults ? `**Контекст выполненных задач:**\n${previousResults.join('\n')}` : ''}

**Верни JSON:**
{
  "status": "completed" | "failed",
  "result": "Детальный результат на русском (прошедшее время)",
  "error": "Сообщение об ошибке, если failed",
  "workflowSteps": ["Шаг 1", "Шаг 2"]
}`
```

**Response Type:** `TaskExecutionResponse`

### 3. generateReportWithSupervisor()

**File:** [intelligentSupervisor.ts:689-748](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts)

**Purpose:** Generate final report after all tasks completed

**Prompt:**
```typescript
`Сгенерируй финальный отчёт о выполнении сложной задачи.

**Оригинальная задача:** ${rootTask.description}

**Статистика:**
- Всего подзадач: ${taskTree.totalTasks}
- Успешно выполнено: ${taskTree.completedTasks}
- Провалено: ${taskTree.failedTasks}

**Верни JSON:**
{
  "summary": "Краткое резюме (2-3 предложения)",
  "detailedResults": "Детальное описание результатов (100-200+ слов)",
  "tasksCompleted": ${taskTree.completedTasks},
  "tasksFailed": ${taskTree.failedTasks},
  "hierarchicalBreakdown": {...}
}`
```

**Response Type:** `FinalReport`

---

## Task Tree Structure

### Task Type

```typescript
interface Task {
  id: string;                // "task-root", "task-root.0", "task-root.0.1"
  parentId: string | null;
  description: string;       // Описание на русском
  complexity: TaskComplexity; // "simple" | "moderate" | "complex"
  status: TaskStatus;        // "planned" | "in_progress" | "completed" | "failed"
  level: number;             // 0 = root, 1 = subtask, etc.

  result?: string;
  error?: string;
  executionStartTime?: Date;
  executionEndTime?: Date;

  subtasks: Task[];
  subtaskResults?: string[];

  dependencies?: string[];   // IDs of tasks that must complete first
}
```

### TaskTree Type

```typescript
interface TaskTree {
  rootTask: Task;
  allTasks: Map<string, Task>;      // Flat map of all tasks by ID
  executionOrder: string[];          // Ordered list of leaf task IDs
  currentTaskId: string | null;

  totalTasks: number;                // Total leaf tasks
  completedTasks: number;
  failedTasks: number;

  conversationHistory: string[];
}
```

### Example Task Tree

```
task-root (complex, completed)
  result: "Организовал встречу со всеми участниками"
  ├─ task-root.0 (moderate, completed)
  │  result: "Нашёл 6 участников проекта"
  │  ├─ task-root.0.0 (simple, completed)
  │  │  result: "Выполнил RAG запрос"
  │  └─ task-root.0.1 (simple, completed)
  │     result: "Извлёк email-адреса"
  │
  ├─ task-root.1 (simple, completed)
  │  result: "Проверил календари участников"
  │
  └─ task-root.2 (moderate, completed)
     result: "Создал событие и отправил приглашения"
     ├─ task-root.2.0 (simple, completed)
     │  result: "Создал событие в календаре"
     └─ task-root.2.1 (simple, completed)
        result: "Отправил приглашения"
```

**Execution order:** task-root.0.0 → task-root.0.1 → task-root.1 → task-root.2.0 → task-root.2.1

---

## Progress Forwarding

IntelligentSupervisor forwards TaskOrchestrator progress to SSE:

```typescript
const orchestrator = new TaskOrchestrator(
  { ... },
  (update) => {
    // TaskOrchestrator progress update
    const progress = 40 + Math.floor((update.progress / 100) * 50); // Map 0-100 to 40-90

    this.emitProgress('step_started', `${update.type}: ${update.taskDescription}`, progress, {
      orchestratorUpdate: update
    });
  }
);
```

**SSE Events during hierarchical execution:**
```
Progress: breakdown_started - Breaking down task-root (40%)
Progress: task_started - Executing task-root.0.0 (45%)
Progress: task_completed - Completed task-root.0.0 (50%)
Progress: task_started - Executing task-root.0.1 (55%)
Progress: task_completed - Completed task-root.0.1 (60%)
...
Progress: task_completed - All tasks completed (90%)
```

---

## Configuration

### Orchestrator Config

```typescript
interface OrchestratorConfig {
  maxNestingLevel: number;              // Default: 5
  maxSubtasksPerTask: number;           // Default: 10
  minTaskComplexityForBreakdown: TaskComplexity;
  enableProgressCallbacks: boolean;
}
```

**Used by IntelligentSupervisor:**
```typescript
const orchestrator = new TaskOrchestrator({
  maxNestingLevel: this.config.maxNestingLevel,    // 5
  maxSubtasksPerTask: this.config.maxSubtasksPerTask, // 10
  enableProgressCallbacks: true
});
```

---

## Performance Characteristics

| Aspect | Value |
|--------|-------|
| **Latency** | 10-30s (depends on task complexity) |
| **SupervisorAgent Calls** | 5-20 (breakdown + execution + report) |
| **MCP Tool Calls** | 8+ (per leaf task) |
| **Max Nesting** | 5 levels |
| **Max Subtasks/Task** | 10 |

**Trade-offs:**
- ✅ Handles very complex multi-step tasks
- ✅ Automatic breakdown with dependency management
- ⚠️ Higher latency than flat strategy
- ⚠️ More SupervisorAgent API calls

---

## Future Enhancements

- [ ] **Parallel execution** of independent subtasks
- [ ] **Retry mechanism** for transient failures
- [ ] **Task prioritization** (critical vs optional)
- [ ] **Persistence** (save TaskTree to DB, resume later)
- [ ] **ML-based breakdown** (learn from successful executions)

---

## Related Documentation

- [README.md](./README.md) — IntelligentSupervisor overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [SUPERVISOR_PROMPT_GUIDE.md](./SUPERVISOR_PROMPT_GUIDE.md) — Supervisor prompt details
- [HIERARCHICAL_TASKS.md](../agents/supervised/HIERARCHICAL_TASKS.md) — Original hierarchical system documentation
- [taskOrchestrator.ts](../../../src/app/api/supervisor/taskOrchestrator.ts) — Full source code

---

**🎯 TaskOrchestrator integrates seamlessly with IntelligentSupervisor to handle complex hierarchical task execution.**
