# Intelligent Supervisor Agent - Unified Task Delegation System

**Version:** 1.0
**Date:** 2025-10-24
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why This Exists](#why-this-exists)
3. [Architecture](#architecture)
4. [Key Features](#key-features)
5. [How It Works](#how-it-works)
6. [Integration](#integration)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)
9. [Related Documentation](#related-documentation)

---

## Overview

**IntelligentSupervisor** — это унифицированная система делегирования задач с автоматической оценкой сложности. Она **заменяет ручной выбор** между двумя путями выполнения:

- **Path 4** (старый `delegateToSupervisor`) — плоский многошаговый workflow для средних задач
- **Path 5** (старый `executeComplexTask`) — иерархическая декомпозиция для сложных задач

**Главное преимущество:** RealtimeAgent больше **НЕ ДОЛЖЕН** решать, какой path использовать — IntelligentSupervisor **автоматически** определяет сложность задачи и выбирает оптимальную стратегию выполнения.

---

## Why This Exists

### Проблема (до IntelligentSupervisor)

RealtimeAgent должен был **вручную определять** сложность задачи и выбирать между двумя инструментами:

```typescript
// ❌ OLD WAY - manual decision
if (isVeryComplex) {
  // Path 5: Hierarchical breakdown
  executeComplexTask(...)
} else if (isModeratelyComplex) {
  // Path 4: Flat workflow
  delegateToSupervisor(...)
} else {
  // Direct MCP tools
  calendar_mcp.read_email(...)
}
```

**Проблемы:**
- ❌ RealtimeAgent (gpt-4o-realtime-mini) не всегда корректно оценивал сложность
- ❌ Промпт становился перегруженным правилами выбора path
- ❌ Сложно тестировать — поведение зависело от промпта realtime агента
- ❌ Дублирование логики в промпте и в коде

### Решение (IntelligentSupervisor)

```typescript
// ✅ NEW WAY - automatic decision
delegateToIntelligentSupervisor({
  taskDescription: "...",
  conversationContext: "..."
  // NO complexity specified!
})
```

**Преимущества:**
- ✅ **Автоматическая оценка** сложности задачи (simple/medium/complex)
- ✅ **Автоматический выбор** стратегии (direct/flat/hierarchical)
- ✅ **Единый интерфейс** — одна tool для всех сложных задач
- ✅ **Прогресс-трекинг** всегда включён (SSE events)
- ✅ **Детальные workflowSteps** для прозрачности выполнения

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│               RealtimeAgent (gpt-4o-realtime-mini)              │
│   Задача: "Прочитай письмо от Анны и назначь встречу..."       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ delegateToIntelligentSupervisor()
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Tool: intelligentSupervisorTool.ts                 │
│  - Generates sessionId for progress tracking                    │
│  - Creates TASK_PROGRESS message in transcript                  │
│  - Calls POST /api/supervisor/unified                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST with sessionId
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Route: unified/route.ts                        │
│  - Validates parameters                                         │
│  - Creates IntelligentSupervisor instance                       │
│  - Passes sessionId for SSE tracking                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ .execute(request)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         IntelligentSupervisor Class (orchestrator)              │
│                                                                 │
│  Step 1: Assess Complexity (using supervisorAgent)             │
│    └─> Returns: { complexity: "simple|medium|complex" }        │
│                                                                 │
│  Step 2: Select Strategy                                       │
│    ├─> simple   → "direct"                                     │
│    ├─> medium   → "flat"                                       │
│    └─> complex  → "hierarchical"                               │
│                                                                 │
│  Step 3: Execute Based on Strategy                             │
│    ├─> DIRECT:        Execute with 1 step (supervisorAgent)   │
│    ├─> FLAT:          Multi-step workflow (Path 4 logic)      │
│    └─> HIERARCHICAL:  Recursive breakdown (TaskOrchestrator)  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Emits SSE events via progressEmitter
                         │ (sessionId-based event routing)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Client (UI)                               │
│  - Subscribes to SSE: /api/supervisor/progress/:sessionId       │
│  - Receives real-time updates (0-100% progress)                 │
│  - Displays TASK_PROGRESS component with live updates          │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/app/
├── agentConfigs/
│   └── severstalAssistantAgent/
│       └── tools/
│           └── intelligentSupervisorTool.ts  ← Tool definition for RealtimeAgent
│
└── api/
    └── supervisor/
        ├── agent.ts                          ← SupervisorAgent + prompt (gpt-4o)
        ├── taskOrchestrator.ts               ← Hierarchical task execution engine
        ├── taskTypes.ts                      ← Task types (Task, TaskTree, etc.)
        └── unified/
            ├── route.ts                      ← API endpoint POST /api/supervisor/unified
            ├── intelligentSupervisor.ts      ← Main IntelligentSupervisor class
            └── progressEmitter.ts            ← SSE progress event emitter

docs/currentImplementation/intelligentSupervisorAgent/
├── README.md                                 ← This file
├── ARCHITECTURE.md                           ← Detailed architecture diagrams
├── SUPERVISOR_PROMPT_GUIDE.md                ← supervisorAgentInstructions guide
├── TASK_ORCHESTRATOR_INTEGRATION.md          ← TaskOrchestrator integration
└── PROGRESS_TRACKING.md                      ← SSE progress tracking guide
```

---

## Key Features

### 1. **Automatic Complexity Assessment**

IntelligentSupervisor вызывает `supervisorAgent` (gpt-4o) для оценки сложности:

```typescript
const assessment = await this.assessComplexity(
  taskDescription,
  conversationContext
);
// Returns: { complexity: "simple|medium|complex", reasoning: "..." }
```

**Критерии оценки:**
- **simple** (1 шаг): "Прочитай последнее письмо"
- **medium** (2-7 шагов): "Прочитай письмо от Анны и назначь встречу"
- **complex** (8+ шагов): "Найди всех участников проекта и отправь приглашения"

### 2. **Adaptive Strategy Selection**

На основе сложности выбирается стратегия выполнения:

```typescript
private selectStrategy(complexity: TaskComplexity): ExecutionStrategy {
  if (complexity === 'simple') return 'direct';
  if (complexity === 'medium') return 'flat';
  return 'hierarchical';
}
```

| Complexity | Strategy      | Execution Method                      |
|------------|---------------|---------------------------------------|
| simple     | direct        | Single-step execution (1 tool call)   |
| medium     | flat          | Multi-step workflow (Path 4 logic)    |
| complex    | hierarchical  | Recursive breakdown (Path 5 logic)    |

### 3. **Three Execution Strategies**

#### Strategy 1: DIRECT (simple tasks)

**Когда:** Задача требует 1 шаг с ясными параметрами.

**Как работает:**
1. Вызывает `supervisorAgent` с промптом "Выполни простую задачу"
2. SupervisorAgent сразу выполняет действие (1 tool call)
3. Возвращает `nextResponse` и `workflowSteps`

**Пример:**
```json
{
  "strategy": "direct",
  "complexity": "simple",
  "nextResponse": "Последнее письмо от Игоря о встрече завтра.",
  "workflowSteps": ["Прочитал последнее письмо через MCP calendar"],
  "progress": { "current": 1, "total": 1 }
}
```

#### Strategy 2: FLAT (medium tasks)

**Когда:** Задача требует 2-7 шагов, координацию, но без иерархии.

**Как работает:**
1. Вызывает `supervisorAgent` с промптом "Выполни многошаговую задачу"
2. SupervisorAgent выполняет последовательность tool calls
3. Возвращает детальный `nextResponse` (40-100+ слов) + `workflowSteps`

**Пример:**
```json
{
  "strategy": "flat",
  "complexity": "medium",
  "nextResponse": "Я прочитал письмо от Анны. Она предлагает встречу в среду в 15:00...",
  "workflowSteps": [
    "Прочитал письмо от Анны от 22 января",
    "Извлёк время встречи: среда 15:00",
    "Проверил календарь — свободно",
    "Создал событие в календаре"
  ],
  "progress": { "current": 4, "total": 4 }
}
```

#### Strategy 3: HIERARCHICAL (complex tasks)

**Когда:** Задача требует 8+ шагов, множественные источники данных, массовые операции.

**Как работает:**
1. Создаёт `TaskOrchestrator`
2. Рекурсивно разбивает задачу на подзадачи (breakdown → execute → collect results)
3. Генерирует финальный отчёт с иерархической структурой
4. Возвращает `hierarchicalBreakdown` + плоский список `workflowSteps`

**Пример:**
```json
{
  "strategy": "hierarchical",
  "complexity": "complex",
  "nextResponse": "Я организовал встречу со всеми участниками проекта 'Восток'...",
  "workflowSteps": [
    "Выполнил RAG запрос для поиска участников",
    "Нашёл 6 участников",
    "Проверил календари всех участников",
    "Нашёл общее время: среда 15:00",
    "Создал событие",
    "Отправил приглашения всем"
  ],
  "hierarchicalBreakdown": { ... },
  "progress": { "current": 7, "total": 7 }
}
```

### 4. **PLAN FIRST vs EXECUTE IMMEDIATELY Modes**

IntelligentSupervisor поддерживает 3 режима выполнения:

```typescript
executionMode: 'auto' | 'plan' | 'execute'
```

#### Mode: `auto` (default)

Supervisor **сам решает**, показывать план или выполнить сразу:
- Простые/средние задачи → EXECUTE IMMEDIATELY
- Сложные задачи с необратимыми действиями → PLAN FIRST

#### Mode: `plan`

PLAN FIRST — возвращает план БЕЗ выполнения:

```json
{
  "nextResponse": "Я составил план. Вот что я сделаю: ...",
  "plannedSteps": [
    "Прочитаю письмо от Анны и извлеку время",
    "Проверю календарь на конфликты",
    "Создам событие если свободно"
  ],
  "workflowSteps": []  // Ничего не выполнено
}
```

#### Mode: `execute`

EXECUTE IMMEDIATELY — выполняет сразу без плана:

```json
{
  "nextResponse": "Я прочитал письмо и создал встречу...",
  "workflowSteps": [
    "Прочитал письмо от Анны",
    "Проверил календарь",
    "Создал событие"
  ],
  "plannedSteps": []  // Нет плана — уже выполнено
}
```

### 5. **Built-in Progress Tracking**

Все стратегии эмитят SSE события через `progressEmitter`:

```typescript
// Progress events (0% → 100%)
{ type: 'started', message: 'Начинаю выполнение...', progress: 0 }
{ type: 'complexity_assessed', message: 'Сложность: medium', progress: 20 }
{ type: 'strategy_selected', message: 'Стратегия: flat', progress: 30 }
{ type: 'step_started', message: 'Выполняю шаг 1...', progress: 40 }
{ type: 'step_completed', message: 'Шаг завершён', progress: 70 }
{ type: 'completed', message: 'Задача выполнена', progress: 100 }
```

---

## How It Works

### End-to-End Flow

```
1. RealtimeAgent detects complex task
   └─> Calls: delegateToIntelligentSupervisor(...)

2. Tool generates sessionId
   └─> Creates TASK_PROGRESS message in transcript
   └─> Calls: POST /api/supervisor/unified

3. API creates IntelligentSupervisor
   └─> Passes sessionId for SSE tracking

4. IntelligentSupervisor.execute()
   ├─> Step 1: Assess complexity (supervisorAgent)
   ├─> Step 2: Select strategy (simple→direct, medium→flat, complex→hierarchical)
   ├─> Step 3: Execute with chosen strategy
   └─> Returns: UnifiedResponse

5. Tool receives response
   └─> Adds workflowSteps as breadcrumbs
   └─> Returns result to RealtimeAgent

6. RealtimeAgent speaks nextResponse to user
```

### Supervisor Prompt Integration

IntelligentSupervisor **полностью полагается** на промпт `supervisorAgentInstructions` (551 строк) из [agent.ts](../../../src/app/api/supervisor/agent.ts).

**Как используется промпт:**

| Method                          | Purpose                              | Relevant Prompt Section                  |
|---------------------------------|--------------------------------------|------------------------------------------|
| `assessComplexity()`            | Оценка сложности                     | Complexity Assessment Rules (lines 202-253) |
| `executeDirectly()`             | Прямое выполнение (simple)           | Tool Execution Protocol (lines 254-260) |
| `executeFlatWorkflow()`         | Многошаговый workflow (medium)       | Approve → EXECUTE IMMEDIATELY (lines 147-170) |
| `generatePlan()`                | Генерация плана (PLAN FIRST)         | Approve → PLAN FIRST (lines 127-146)    |
| `breakdownTaskWithSupervisor()` | Разбиение на подзадачи (hierarchical)| Complexity Assessment (lines 223-253)   |
| `executeSingleTaskWithAgent()`  | Выполнение одной подзадачи           | Tool Execution Protocol (lines 254-260) |
| `generateReportWithSupervisor()`| Финальный отчёт                      | Response Format Requirements (lines 262-313) |

**См. подробности:** [SUPERVISOR_PROMPT_GUIDE.md](./SUPERVISOR_PROMPT_GUIDE.md)

---

## Integration

### Adding to RealtimeAgent

**1. Import tool:**

```typescript
// src/app/agentConfigs/severstalAssistantAgent/index.ts
import { delegateToIntelligentSupervisor } from './tools/intelligentSupervisorTool';

export const severstalAssistant = new RealtimeAgent({
  name: 'severstalAssistant',
  tools: [
    hostedMcpTool(...),
    lightragQueryTool,
    delegateToIntelligentSupervisor,  // ← NEW
  ],
});
```

**2. Update agent prompt:**

```markdown
## Tool: delegateToIntelligentSupervisor

**Используй для СЛОЖНЫХ задач (2+ шагов):**
- ✅ Множественные действия с координацией
- ✅ Условная логика ("если..., то...")
- ✅ Кросс-референсы между источниками данных
- ✅ Не уверен в сложности → делегируй сюда

**НЕ используй для:**
- ❌ Простые одношаговые действия (используй MCP tools)
- ❌ Только RAG запрос (используй lightrag_query)

**Preamble перед вызовом:**
«Секундочку, проверю...»
«Один момент, уточню детали...»
```

### API Usage

**Request:**

```typescript
POST /api/supervisor/unified
Content-Type: application/json

{
  "taskDescription": "Прочитай письмо от Анны и назначь встречу на предложенное время",
  "conversationContext": "Пользователь просит организовать встречу на основе письма",
  "executionMode": "auto",        // Optional: 'auto' | 'plan' | 'execute'
  "maxComplexity": "hierarchical", // Optional: 'flat' | 'hierarchical'
  "sessionId": "session-123"       // Optional: for SSE tracking
}
```

**Response:**

```typescript
{
  "strategy": "flat",
  "complexity": "medium",
  "nextResponse": "Я прочитал письмо от Анны...",
  "workflowSteps": [
    "Прочитал письмо от Анны",
    "Извлёк время встречи",
    "Проверил календарь",
    "Создал событие"
  ],
  "progress": { "current": 4, "total": 4 },
  "executionTime": 2350,
  "sessionId": "session-123"
}
```

---

## Usage Examples

### Example 1: Simple Task → DIRECT Strategy

**User:** "Прочитай последнее письмо"

**RealtimeAgent:**
```typescript
delegateToIntelligentSupervisor({
  taskDescription: "Прочитать последнее письмо из почты",
  conversationContext: "Пользователь просит прочитать последнее письмо"
})
```

**IntelligentSupervisor Flow:**
1. Assess complexity → `simple`
2. Select strategy → `direct`
3. Execute with supervisorAgent (1 tool call)

**Response:**
```json
{
  "strategy": "direct",
  "complexity": "simple",
  "nextResponse": "Последнее письмо от Игоря о встрече завтра в три часа.",
  "workflowSteps": ["Прочитал последнее письмо через Calendar MCP"]
}
```

### Example 2: Medium Task → FLAT Strategy

**User:** "Прочитай письмо от Анны и назначь встречу на время, которое она предложила"

**RealtimeAgent:**
```typescript
delegateToIntelligentSupervisor({
  taskDescription: "Прочитать письмо от Анны, извлечь предложенное время встречи, проверить календарь на конфликты, создать событие",
  conversationContext: "Пользователь хочет назначить встречу на основе информации из письма Анны"
})
```

**IntelligentSupervisor Flow:**
1. Assess complexity → `medium` (4 steps, coordination needed)
2. Select strategy → `flat`
3. Execute multi-step workflow

**Response:**
```json
{
  "strategy": "flat",
  "complexity": "medium",
  "nextResponse": "Я прочитал письмо от Анны, отправленное сегодня утром. Она предлагает встречу в среду, пятнадцатого января, в три часа дня. Тема — обсуждение проекта 'Восток'. Я проверил ваш календарь на это время — у вас свободно. Встреча успешно запланирована на среду в пятнадцать ноль-ноль, длительность один час.",
  "workflowSteps": [
    "Прочитал письмо от Анны от 22 января 10:30",
    "Извлёк время встречи: среда 15 января 15:00",
    "Проверил календарь — свободно",
    "Создал событие в календаре: среда 15:00-16:00"
  ],
  "progress": { "current": 4, "total": 4 }
}
```

### Example 3: Complex Task → HIERARCHICAL Strategy

**User:** "Найди всех участников проекта Восток из переписки, проверь их календари на следующую неделю, и отправь всем приглашение на встречу"

**RealtimeAgent:**
```typescript
delegateToIntelligentSupervisor({
  taskDescription: "Найти всех участников проекта Восток в переписке через RAG, извлечь их email-адреса, проверить календари всех участников на следующую неделю, найти общее свободное время, создать событие, отправить приглашения всем участникам",
  conversationContext: "Пользователь хочет организовать встречу со всеми участниками проекта"
})
```

**IntelligentSupervisor Flow:**
1. Assess complexity → `complex` (8+ steps, multiple data sources, mass operation)
2. Select strategy → `hierarchical`
3. Create TaskOrchestrator
4. Recursive breakdown:
   ```
   Root: "Организовать встречу"
     ├─ Subtask 1: "Найти участников"
     │   ├─ 1.1: RAG запрос
     │   └─ 1.2: Извлечь emails
     ├─ Subtask 2: "Проверить календари"
     └─ Subtask 3: "Создать событие и отправить приглашения"
   ```
5. Execute tasks depth-first
6. Generate final report

**Response:**
```json
{
  "strategy": "hierarchical",
  "complexity": "complex",
  "nextResponse": "Я организовал встречу со всеми участниками проекта 'Восток'. Нашёл шесть участников: Иван Петров, Анна Смирнова, Пётр Сидоров, Марина Кузнецова, Сергей Волков и Ольга Николаева. Проверил их календари на следующую неделю и нашёл общее свободное время: среда, пятнадцатого января, в четырнадцать ноль-ноль. Создал событие в календаре на два часа и отправил приглашения всем участникам.",
  "workflowSteps": [
    "Выполнил RAG запрос: участники проекта Восток",
    "Нашёл 6 участников",
    "Извлёк email-адреса",
    "Проверил календари всех участников",
    "Нашёл общее время: среда 15 января 14:00",
    "Создал событие на 2 часа",
    "Отправил приглашения всем участникам"
  ],
  "hierarchicalBreakdown": { ... },
  "progress": { "current": 7, "total": 7 },
  "executionTime": 12500
}
```

---

## Configuration

### IntelligentSupervisor Config

```typescript
const supervisor = new IntelligentSupervisor({
  enableProgressCallbacks: true,    // Enable SSE progress tracking
  maxComplexity: 'hierarchical',    // 'flat' | 'hierarchical'
  maxNestingLevel: 5,               // Max task breakdown depth (hierarchical only)
  maxSubtasksPerTask: 10,           // Max subtasks per task (hierarchical only)
  sessionId: 'session-abc123'       // Session ID for SSE routing
});
```

### Tool Parameters

```typescript
delegateToIntelligentSupervisor({
  taskDescription: string,          // REQUIRED: Full task description (2-5 sentences)
  conversationContext: string,      // REQUIRED: Conversation summary (2-3 sentences)
  executionMode?: 'auto' | 'plan' | 'execute'  // Optional (default: 'auto')
})
```

---

## Related Documentation

### Core Documentation

- [**ARCHITECTURE.md**](./ARCHITECTURE.md) — Detailed architecture diagrams and data flow
- [**SUPERVISOR_PROMPT_GUIDE.md**](./SUPERVISOR_PROMPT_GUIDE.md) — Complete guide to supervisorAgentInstructions
- [**TASK_ORCHESTRATOR_INTEGRATION.md**](./TASK_ORCHESTRATOR_INTEGRATION.md) — How hierarchical execution works
- [**PROGRESS_TRACKING.md**](./PROGRESS_TRACKING.md) — SSE progress tracking implementation
- [**AGENT_ARCHITECTURE_DECISION.md**](./AGENT_ARCHITECTURE_DECISION.md) — Why we use single agent instead of 7 separate agents

### Related Code Files

- [intelligentSupervisorTool.ts](../../../src/app/agentConfigs/severstalAssistantAgent/tools/intelligentSupervisorTool.ts) — Tool definition
- [unified/route.ts](../../../src/app/api/supervisor/unified/route.ts) — API endpoint
- [unified/intelligentSupervisor.ts](../../../src/app/api/supervisor/unified/intelligentSupervisor.ts) — Main class
- [agent.ts](../../../src/app/api/supervisor/agent.ts) — SupervisorAgent + prompt
- [taskOrchestrator.ts](../../../src/app/api/supervisor/taskOrchestrator.ts) — Hierarchical execution engine

### Existing Documentation

- [Supervised Agents](../agents/supervised/README.md) — Old Path 4 documentation
- [Hierarchical Tasks](../agents/supervised/HIERARCHICAL_TASKS.md) — Old Path 5 documentation

---

## Comparison: Old vs New

| Aspect | OLD (Manual Paths) | NEW (IntelligentSupervisor) |
|--------|--------------------|-----------------------------|
| **Complexity Decision** | RealtimeAgent prompts | Automatic (supervisorAgent) |
| **Number of Tools** | 2 tools (Path 4 + Path 5) | 1 unified tool |
| **Progress Tracking** | Manual implementation | Built-in SSE events |
| **workflowSteps** | Optional in Path 4 | Always included |
| **PLAN FIRST Mode** | Only Path 5 | All strategies support |
| **Error Handling** | Inconsistent | Unified error responses |
| **Testing** | Test 2 separate paths | Test 1 unified system |
| **Prompt Complexity** | High (decision rules) | Low (delegate everything) |

---

## Migration from Old System

**Before (Path 4 + Path 5):**

```typescript
// RealtimeAgent had to decide:
tools: [
  delegateToSupervisor,      // Path 4: flat workflow
  executeComplexTask,        // Path 5: hierarchical
]
```

**After (IntelligentSupervisor):**

```typescript
// Single tool, automatic decision:
tools: [
  delegateToIntelligentSupervisor,  // Replaces both paths
]
```

**Prompt Migration:**

```diff
- ## When to use delegateToSupervisor (Path 4):
- - 2-7 шагов
- - Координация
-
- ## When to use executeComplexTask (Path 5):
- - 8+ шагов
- - Иерархическая декомпозиция

+ ## When to use delegateToIntelligentSupervisor:
+ - Любая сложная задача (2+ шагов)
+ - НЕ нужно оценивать сложность — система сделает сама
```

---

## Status & Future Work

### ✅ Implemented (v1.0)

- [x] Automatic complexity assessment
- [x] Three execution strategies (direct/flat/hierarchical)
- [x] SSE progress tracking
- [x] PLAN FIRST / EXECUTE IMMEDIATELY modes
- [x] Unified API endpoint
- [x] Tool integration with RealtimeAgent
- [x] workflowSteps always included

### 🚧 Planned (Future Versions)

- [ ] Parallel execution of independent subtasks (hierarchical strategy)
- [ ] Retry mechanism for transient failures
- [ ] Task priority levels (critical vs optional subtasks)
- [ ] Persistence & resume (save TaskTree state to DB)
- [ ] ML-based complexity prediction (learn from history)
- [ ] UI component for hierarchical breakdown visualization

---

**🎉 IntelligentSupervisor упрощает делегирование сложных задач, автоматически выбирая оптимальную стратегию выполнения!**
