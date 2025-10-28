# Complete Workflow: Voice Request → Hierarchical Task Execution

**Version:** 1.0
**Date:** 2025-10-22

---

## Full Request Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                    1. User Voice Request                            │
│                 "Найди участников проекта..."                      │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│              2. RealtimeAgent (severstalAssistant)                  │
│                                                                      │
│  - Receives audio via WebRTC                                        │
│  - Transcribes user request                                         │
│  - Analyzes complexity (1 step? 2-7 steps? 8+ steps?)             │
│  - Decides which tool to use                                        │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┬──────────────┐
            │              │              │              │
            ▼              ▼              ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   3A. Simple    │ │  3B. RAG Query  │ │ 3C. Moderate    │ │  3D. VERY       │
│   (1 step)      │ │                 │ │ (2-7 steps)     │ │  Complex        │
│                 │ │                 │ │                 │ │  (8+ steps)     │
│ MCP Tool        │ │ lightrag_query  │ │ delegateToSup   │ │ executeComplex  │
│ (Calendar/Email)│ │                 │ │                 │ │ Task            │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │                   │
         │                   │                   │                   │
         │                   │                   ▼                   ▼
         │                   │          ┌──────────────────┐ ┌────────────────────┐
         │                   │          │ 4. Supervisor    │ │ 4. TaskOrchestrator │
         │                   │          │    Agent API     │ │    API              │
         │                   │          │ /api/supervisor  │ │ /api/tasks/execute  │
         │                   │          └────────┬─────────┘ └────────┬────────────┘
         │                   │                   │                   │
         │                   │                   ▼                   ▼
         │                   │          ┌──────────────────┐ ┌────────────────────┐
         │                   │          │ SupervisorAgent  │ │ Recursive Breakdown │
         │                   │          │ (GPT-4o)         │ │                     │
         │                   │          │                  │ │ 1. Root task        │
         │                   │          │ - Plans/Executes │ │ 2. Breakdown        │
         │                   │          │ - Returns result │ │ 3. Create subtasks  │
         │                   │          │   + workflow     │ │ 4. Repeat for each  │
         │                   │          │   Steps          │ │                     │
         │                   │          └────────┬─────────┘ └────────┬────────────┘
         │                   │                   │                   │
         │                   │                   │                   ▼
         │                   │                   │          ┌────────────────────┐
         │                   │                   │          │ Execute Subtasks   │
         │                   │                   │          │ (via Supervisor)   │
         │                   │                   │          │                    │
         │                   │                   │          │ For each leaf task:│
         │                   │                   │          │ - Call Supervisor  │
         │                   │                   │          │ - Get result       │
         │                   │                   │          │ - Collect results  │
         │                   │                   │          └────────┬───────────┘
         │                   │                   │                   │
         │                   │                   │                   ▼
         │                   │                   │          ┌────────────────────┐
         │                   │                   │          │ Generate Report    │
         │                   │                   │          │ (via Supervisor)   │
         │                   │                   │          │                    │
         │                   │                   │          │ - Summary          │
         │                   │                   │          │ - Detailed results │
         │                   │                   │          │ - Statistics       │
         │                   │                   │          │ - Hierarchy        │
         │                   │                   │          └────────┬───────────┘
         │                   │                   │                   │
         └───────────────────┴───────────────────┴───────────────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────┐
                                    │ 5. RealtimeAgent     │
                                    │    Receives Result   │
                                    │                      │
                                    │ - Formats for voice  │
                                    │ - Speaks to user     │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │ 6. User Hears        │
                                    │    Response (Audio)  │
                                    └──────────────────────┘
```

---

## Step-by-Step Explanation

### Step 1: User Voice Request

User speaks to RealtimeAgent via browser/app:
> "Найди всех участников проекта Восток из переписки, проверь их календари на следующую неделю, найди время когда все свободны, и отправь всем приглашение на встречу"

**Audio:** User's voice → WebRTC → RealtimeSession
**Transcription:** OpenAI Realtime API transcribes to text

---

### Step 2: RealtimeAgent Analyzes Request

`severstalAssistant` (RealtimeAgent) analyzes the request:

```typescript
// In RealtimeAgent (gpt-4o-realtime-mini)
// Agent reads improved prompt (v2.0) with tool selection matrix

Analysis:
- Count steps: 1) Find participants, 2) Check calendars, 3) Find common time, 4) Send invitations
- Total: 8+ steps
- Affects multiple people: YES
- Mass operation: YES
- Complexity: VERY HIGH

Decision: Use executeComplexTask tool
```

**RealtimeAgent speaks preamble:**
> "Это очень сложная задача. Выполнение может занять несколько минут. Продолжить?"

**User confirms:** "Да"

**RealtimeAgent calls tool:**
```javascript
executeComplexTask({
  taskDescription: "Найди всех участников проекта 'Восток' из переписки за последний месяц, включая их email-адреса. Затем проверь календари каждого участника на следующую неделю (с 13 по 17 января) и найди временные слоты, когда все свободны одновременно. После того как найдёшь общее время, создай событие в календаре на 2 часа с темой 'Встреча команды проекта Восток' и отправь email-приглашения всем участникам с деталями встречи.",
  conversationContext: "Пользователь руководит проектом 'Восток' и хочет организовать встречу со всей командой на следующей неделе."
})
```

---

### Step 3D: Tool Handler Calls API

`executeComplexTaskTool.ts` tool handler:

```typescript
// Tool execute function
const response = await fetch('/api/tasks/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskDescription,
    conversationContext,
  }),
});
```

---

### Step 4: TaskOrchestrator API

`/api/tasks/execute` (POST handler):

```typescript
// 1. Create TaskOrchestrator
const orchestrator = new TaskOrchestrator({
  maxNestingLevel: 5,
  maxSubtasksPerTask: 10,
});

// 2. Execute complex task
const report = await orchestrator.executeComplexTask(
  taskDescription,
  conversationContext,
  breakdownTaskWithSupervisor,    // Function
  executeSingleTaskWithAgent,      // Function
  generateReportWithSupervisor     // Function
);

// 3. Return report
return NextResponse.json({ success: true, report });
```

---

### Step 4.1: Recursive Breakdown

`TaskOrchestrator.breakdownTaskRecursively()`:

```typescript
// For root task
const breakdown = await breakdownFn({
  task: rootTask,
  conversationContext,
});

// SupervisorAgent analyzes and returns:
{
  "shouldBreakdown": true,
  "subtasks": [
    {
      "description": "Найду всех участников проекта 'Восток' через RAG запрос к переписке",
      "estimatedComplexity": "moderate"
    },
    {
      "description": "Извлеку email-адреса всех найденных участников",
      "estimatedComplexity": "simple",
      "dependencies": [0]  // Depends on subtask 0
    },
    {
      "description": "Проверю календари каждого участника на 13-17 января",
      "estimatedComplexity": "moderate",
      "dependencies": [1]
    },
    {
      "description": "Найду временные слоты, когда все участники свободны",
      "estimatedComplexity": "simple",
      "dependencies": [2]
    },
    {
      "description": "Создам событие в календаре на выбранное время",
      "estimatedComplexity": "simple",
      "dependencies": [3]
    },
    {
      "description": "Отправлю email-приглашения всем участникам",
      "estimatedComplexity": "moderate",
      "dependencies": [4]
    }
  ]
}
```

**Creates task tree:**
```
Root: "Организовать встречу команды"
├─ Task 0: "Найду участников через RAG" (moderate) → breaks down further
│   ├─ Task 0.0: "Выполню RAG запрос" (simple) ✓
│   └─ Task 0.1: "Извлеку имена и контакты" (simple) ✓
├─ Task 1: "Извлеку email-адреса" (simple) ✓
├─ Task 2: "Проверю календари" (moderate) → breaks down
│   ├─ Task 2.0: "Получу доступ к календарям" (simple) ✓
│   └─ Task 2.1: "Извлеку занятость каждого" (simple) ✓
├─ Task 3: "Найду общие слоты" (simple) ✓
├─ Task 4: "Создам событие" (simple) ✓
└─ Task 5: "Отправлю приглашения" (moderate) ✓
```

---

### Step 4.2: Execute Subtasks

`TaskOrchestrator.executeTasksInOrder()`:

Execution order (leaf tasks only):
```
1. Task 0.0 → SupervisorAgent executes → Result: "Найдено 6 участников: Иван, Анна, Пётр, Марина, Сергей, Ольга"
2. Task 0.1 → SupervisorAgent executes → Result: "Извлечены контакты"
3. Task 1 → SupervisorAgent executes → Result: "6 email-адресов"
4. Task 2.0 → SupervisorAgent executes → Result: "Доступ получен"
5. Task 2.1 → SupervisorAgent executes → Result: "Занятость извлечена"
6. Task 3 → SupervisorAgent executes → Result: "Найдено общее время: среда 15 января 14:00"
7. Task 4 → SupervisorAgent executes → Result: "Событие создано"
8. Task 5 → SupervisorAgent executes → Result: "Приглашения отправлены"
```

**Each execution calls SupervisorAgent:**
```typescript
const result = await run(supervisorAgent, executionPrompt);
// Parses response to get workflowSteps and result
```

---

### Step 4.3: Collect Results Hierarchically

`TaskManager.collectResults()`:

```
Task 0.0 + Task 0.1 → Task 0 result
Task 2.0 + Task 2.1 → Task 2 result
All → Root task result
```

---

### Step 4.4: Generate Final Report

`generateReportWithSupervisor()`:

SupervisorAgent creates final report:

```json
{
  "summary": "Я организовал встречу со всеми участниками проекта 'Восток'.",
  "detailedResults": "Нашёл шесть участников: Иван Петров, Анна Смирнова, Пётр Сидоров, Марина Кузнецова, Сергей Волков и Ольга Николаева. Проверил их календари на следующую неделю (с тринадцатого по семнадцатое января) и нашёл общее свободное время: среда, пятнадцатого января, в четырнадцать ноль-ноль. Создал событие в календаре на два часа с темой 'Встреча команды проекта Восток' и отправил приглашения всем участникам. Все получат email с деталями встречи.",
  "tasksCompleted": 8,
  "tasksFailed": 0,
  "executionTime": 12500,
  "hierarchicalBreakdown": { /* tree */ }
}
```

---

### Step 5: RealtimeAgent Receives Result

`executeComplexTaskTool.ts` returns to RealtimeAgent:

```javascript
return {
  success: true,
  summary: report.summary,
  detailedResults: formattedReport,  // Voice-optimized
  tasksCompleted: 8,
  tasksFailed: 0,
};
```

**RealtimeAgent speaks:**
> "Готово! Я организовал встречу со всеми участниками проекта 'Восток'. Нашёл шесть участников: Иван Петров, Анна Смирнова, Пётр Сидоров, Марина Кузнецова, Сергей Волков и Ольга Николаева. Проверил их календари на следующую неделю и нашёл общее свободное время: среда, пятнадцатого января, в четырнадцать ноль-ноль. Создал событие в календаре на два часа и отправил приглашения всем участникам. Всего выполнено восемь задач."

---

### Step 6: User Hears Response

Audio is streamed back to user via WebRTC.

---

## Key Points

### 1. **Entry Point: RealtimeAgent**
- ALL user requests start here
- Voice transcription happens automatically
- Agent decides which tool based on complexity

### 2. **Tool Selection Logic** (in RealtimeAgent prompt)
```
1 step, simple → MCP tools directly
RAG search → lightrag_query
2-7 steps → delegateToSupervisor
8+ steps, mass ops → executeComplexTask
```

### 3. **Server-Side Processing**
- `executeComplexTask` is a tool with `execute` function
- Execute function calls `/api/tasks/execute` (server-side)
- Server runs TaskOrchestrator which calls SupervisorAgent multiple times

### 4. **No Direct Realtime→Supervisor Communication**
- RealtimeAgent does NOT call SupervisorAgent directly via WebRTC
- All complex processing happens server-side (HTTP/REST)
- Results flow back through tool return value

### 5. **Hierarchical Execution**
- Root task → breakdown → subtasks → breakdown → leaf tasks
- Leaf tasks executed sequentially (with dependencies)
- Results collected bottom-up (hierarchical)

### 6. **Multiple SupervisorAgent Invocations**
For very complex task, SupervisorAgent called:
1. Once per task breakdown (recursive)
2. Once per leaf task execution
3. Once for final report generation

Total: ~10-20 SupervisorAgent calls for complex task

---

## File Locations

### Configuration:
- **RealtimeAgent**: `src/app/agentConfigs/severstalAssistantAgent/index.ts`
- **Improved Prompt**: `src/app/agentConfigs/severstalAssistantAgent/improvedPrompt.ts`
- **executeComplexTask Tool**: `src/app/agentConfigs/severstalAssistantAgent/executeComplexTaskTool.ts`

### Server-Side:
- **API Endpoint**: `src/app/api/tasks/route.ts`
- **TaskOrchestrator**: `src/app/api/supervisor/taskOrchestrator.ts`
- **Task Types**: `src/app/api/supervisor/taskTypes.ts`
- **SupervisorAgent**: `src/app/api/supervisor/agent.ts`

### Documentation:
- **Architecture**: `docs/agents/supervised/ARCHITECTURE_OVERVIEW.md`
- **Hierarchical Tasks**: `docs/agents/supervised/HIERARCHICAL_TASKS.md`
- **This File**: `docs/agents/supervised/WORKFLOW_STEPS_USAGE.md`

---

## Testing the Flow

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Open Browser
```
http://localhost:3000
```

### 3. Select Scenario
- Choose "Severstal Assistant" from dropdown

### 4. Connect
- Click "Connect" button
- Allow microphone access

### 5. Test Simple Task
> "Прочитай последнее письмо"

Expected flow: RealtimeAgent → MCP tool → Result

### 6. Test Complex Task
> "Найди всех участников проекта Восток, проверь их календари и отправь приглашения"

Expected flow: RealtimeAgent → executeComplexTask → TaskOrchestrator → Multiple Supervisor calls → Report → Voice

---

## Performance Considerations

### Simple Task (MCP direct):
- Latency: ~1-2 seconds
- Cost: Minimal (realtime API only)

### Moderate Task (Supervisor):
- Latency: ~5-10 seconds
- Cost: 1 GPT-4o call

### Very Complex Task (Hierarchical):
- Latency: ~30-120 seconds (minutes)
- Cost: 10-20 GPT-4o calls
- User experience: Warning + confirmation + progress updates

---

## Troubleshooting

### "executeComplexTask tool not found"
→ Check `severstalAssistant` tools array includes `executeComplexTask`

### "TaskOrchestrator timeout"
→ Increase timeout in `/api/tasks/route.ts`
→ Reduce `maxNestingLevel` or `maxSubtasksPerTask`

### "SupervisorAgent returns invalid JSON"
→ Check prompt formatting in `/api/supervisor/agent.ts`
→ Verify JSON parsing in breakdown/execution functions

### "Task execution fails silently"
→ Check logs with prefix `[TaskOrchestrator]`, `[breakdownTask]`, `[executeSingleTask]`
→ Verify SupervisorAgent has access to MCP tools

---

**Готово!** 🎉

Полный цикл от голосового запроса до иерархического выполнения задач документирован и работает.
