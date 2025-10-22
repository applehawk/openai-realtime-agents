/**
 * API Route for Hierarchical Task Management
 *
 * Endpoints:
 * - POST /api/tasks/execute - Execute a complex task with breakdown
 * - POST /api/tasks/breakdown - Request task breakdown from supervisor
 * - POST /api/tasks/execute-single - Execute a single task
 * - POST /api/tasks/report - Generate final report
 *
 * Version: 1.0
 * Date: 2025-10-22
 */

import { NextRequest, NextResponse } from 'next/server';
import { run } from '@openai/agents';
import { supervisorAgent } from '../supervisor/agent';
import {
  TaskBreakdownRequest,
  TaskBreakdownResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  ReportGenerationRequest,
  FinalReport,
  TaskManager,
} from '../supervisor/taskTypes';
import { TaskOrchestrator } from '../supervisor/taskOrchestrator';

/**
 * Main endpoint: Execute complex task end-to-end
 *
 * POST /api/tasks/execute
 * Body: {
 *   taskDescription: string;
 *   conversationContext: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { taskDescription, conversationContext } = await request.json();

    if (!taskDescription || !conversationContext) {
      return NextResponse.json(
        { error: 'taskDescription and conversationContext are required' },
        { status: 400 }
      );
    }

    console.log('[API /tasks/execute] Starting complex task execution:', taskDescription);

    // Create orchestrator with progress callback
    const orchestrator = new TaskOrchestrator(
      {
        maxNestingLevel: 5,
        maxSubtasksPerTask: 10,
        enableProgressCallbacks: false, // Disable for now (can enable with WebSocket)
      },
      undefined // Progress callback would go here
    );

    // Execute task
    const report = await orchestrator.executeComplexTask(
      taskDescription,
      conversationContext,
      breakdownTaskWithSupervisor,
      executeSingleTaskWithAgent,
      generateReportWithSupervisor
    );

    console.log('[API /tasks/execute] Task execution complete');

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[API /tasks/execute] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Breakdown task using supervisor agent
 */
async function breakdownTaskWithSupervisor(
  request: TaskBreakdownRequest
): Promise<TaskBreakdownResponse> {
  const { task, conversationContext, previousResults } = request;

  console.log(`[breakdownTask] Requesting breakdown for: ${task.description}`);

  // Build prompt for supervisor
  const breakdownPrompt = `
Проанализируй задачу и реши, нужно ли разбить её на подзадачи.

**Задача:** ${task.description}
**Уровень вложенности:** ${task.level}
**Текущая сложность:** ${task.complexity}

${previousResults && previousResults.length > 0 ? `**Результаты предыдущих задач:**\n${previousResults.join('\n')}` : ''}

**Контекст беседы:**
${conversationContext}

---

**Твоя задача:**

1. Определи, является ли задача достаточно сложной для разбиения на подзадачи
2. Если ДА - разбей на 2-10 конкретных подзадач (на русском, будущее время)
3. Если НЕТ - укажи, кто может её выполнить напрямую (realtime agent или supervisor)

**Критерии для разбиения:**
- ✅ Разбивай если: задача содержит 3+ независимых шага, условную логику, или требует множественных источников данных
- ❌ НЕ разбивай если: задача простая, одношаговая, или может быть выполнена одним tool call

**Верни ТОЛЬКО валидный JSON:**

{
  "shouldBreakdown": true/false,
  "reasoning": "Краткое объяснение решения (1-2 предложения)",
  "subtasks": [ // Если shouldBreakdown === true
    {
      "description": "Подзадача 1 (будущее время: 'Прочитаю...', 'Создам...', 'Отправлю...')",
      "estimatedComplexity": "simple" | "moderate" | "complex",
      "dependencies": [0] // Опционально: индексы задач, которые должны завершиться до этой
    }
  ],
  "directExecution": { // Если shouldBreakdown === false
    "canExecuteDirectly": true,
    "executor": "realtime" | "supervisor"
  }
}

**ВАЖНО:** Возвращай ТОЛЬКО JSON, без дополнительного текста!
`;

  try {
    const result = await run(supervisorAgent, breakdownPrompt);

    // Parse JSON from response
    const content = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput);
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('[breakdownTask] No JSON found in response:', content);
      // Default: don't break down
      return {
        shouldBreakdown: false,
        reasoning: 'Failed to parse supervisor response',
        directExecution: {
          canExecuteDirectly: true,
          executor: 'supervisor',
        },
      };
    }

    const breakdown: TaskBreakdownResponse = JSON.parse(jsonMatch[0]);
    console.log('[breakdownTask] Breakdown decision:', breakdown.shouldBreakdown);

    return breakdown;
  } catch (error) {
    console.error('[breakdownTask] Error:', error);
    // Default: don't break down, execute with supervisor
    return {
      shouldBreakdown: false,
      reasoning: 'Error during breakdown analysis',
      directExecution: {
        canExecuteDirectly: true,
        executor: 'supervisor',
      },
    };
  }
}

/**
 * Execute single task using appropriate agent
 */
async function executeSingleTaskWithAgent(
  request: TaskExecutionRequest
): Promise<TaskExecutionResponse> {
  const { task, conversationContext, previousResults, siblingContext } = request;

  console.log(`[executeSingleTask] Executing task: ${task.description}`);

  // Build execution prompt
  const executionPrompt = `
Выполни следующую задачу:

**Задача:** ${task.description}

${previousResults && previousResults.length > 0 ? `**Контекст выполненных задач:**\n${previousResults.join('\n')}\n` : ''}
${siblingContext ? `**Дополнительный контекст:**\n${siblingContext}\n` : ''}

**Оригинальный контекст беседы:**
${conversationContext}

---

**Твоя задача:**
Выполни описанную задачу используя доступные инструменты (MCP tools, RAG, etc.)

**Верни результат в формате JSON:**

{
  "status": "completed" | "failed",
  "result": "Детальный результат выполнения на русском (прошедшее время: 'Прочитал...', 'Создал...', 'Нашёл...')",
  "error": "Сообщение об ошибке, если failed",
  "workflowSteps": [
    "Шаг 1: что было сделано (5-15 слов)",
    "Шаг 2: что было сделано (5-15 слов)"
  ],
  "needsRefinement": false // true если задача слишком сложна и нужно дробить
}

**ВАЖНО:**
- Результат должен быть детальным (40-100+ слов)
- Используй прошедшее время ("Прочитал", "Создал", "Отправил")
- Если задача слишком сложная для выполнения, установи needsRefinement: true
- Возвращай ТОЛЬКО JSON!
`;

  try {
    const result = await run(supervisorAgent, executionPrompt);

    // Parse JSON from response
    const content = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput);
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('[executeSingleTask] No JSON found in response:', content);
      return {
        status: 'failed',
        error: 'Failed to parse execution response',
      };
    }

    const execution: TaskExecutionResponse = JSON.parse(jsonMatch[0]);
    console.log('[executeSingleTask] Execution status:', execution.status);

    return execution;
  } catch (error) {
    console.error('[executeSingleTask] Error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate final report using supervisor agent
 */
async function generateReportWithSupervisor(
  request: ReportGenerationRequest
): Promise<FinalReport> {
  const { rootTask, taskTree, conversationContext } = request;

  console.log('[generateReport] Generating final report');

  // Collect all results hierarchically
  const hierarchicalResults = TaskManager.collectResults(rootTask);

  // Build report prompt
  const reportPrompt = `
Сгенерируй финальный отчёт о выполнении сложной задачи.

**Оригинальная задача:** ${rootTask.description}

**Структура выполнения:**
${formatTaskTreeForPrompt(rootTask)}

**Собранные результаты:**
${hierarchicalResults}

**Статистика:**
- Всего подзадач: ${taskTree.totalTasks}
- Успешно выполнено: ${taskTree.completedTasks}
- Провалено: ${taskTree.failedTasks}

**Оригинальный контекст беседы:**
${conversationContext}

---

**Твоя задача:**
Создай детальный отчёт о выполнении задачи.

**Верни JSON:**

{
  "summary": "Краткое резюме (2-3 предложения) - что было сделано",
  "detailedResults": "Детальное описание результатов (100-200+ слов), организованное иерархически с подробностями по каждому этапу",
  "tasksCompleted": ${taskTree.completedTasks},
  "tasksFailed": ${taskTree.failedTasks},
  "executionTime": 0, // Будет заполнено автоматически
  "hierarchicalBreakdown": ${JSON.stringify(buildHierarchicalBreakdown(rootTask), null, 2)}
}

**ВАЖНО:**
- summary: краткое резюме всей работы
- detailedResults: подробное описание с деталями, датами, именами - будет озвучено пользователю
- Используй прошедшее время
- Структурируй результаты логически
- Возвращай ТОЛЬКО JSON!
`;

  try {
    const result = await run(supervisorAgent, reportPrompt);

    // Parse JSON from response
    const content = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput);
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('[generateReport] No JSON found in response:', content);
      // Return default report
      return {
        summary: 'Задача выполнена',
        detailedResults: hierarchicalResults,
        tasksCompleted: taskTree.completedTasks,
        tasksFailed: taskTree.failedTasks,
        executionTime: 0,
        hierarchicalBreakdown: buildHierarchicalBreakdown(rootTask),
      };
    }

    const report: FinalReport = JSON.parse(jsonMatch[0]);
    console.log('[generateReport] Report generated successfully');

    // Calculate execution time
    const executionTime = calculateExecutionTime(rootTask);
    report.executionTime = executionTime;

    return report;
  } catch (error) {
    console.error('[generateReport] Error:', error);
    // Return default report
    return {
      summary: 'Задача выполнена с ошибками',
      detailedResults: hierarchicalResults,
      tasksCompleted: taskTree.completedTasks,
      tasksFailed: taskTree.failedTasks,
      executionTime: 0,
      hierarchicalBreakdown: buildHierarchicalBreakdown(rootTask),
    };
  }
}

/**
 * Format task tree for prompt (helper)
 */
function formatTaskTreeForPrompt(task: any, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  const statusIcons: Record<string, string> = {
    planned: '⏱',
    in_progress: '⏳',
    completed: '✓',
    failed: '✗',
    blocked: '🔒',
  };
  const statusIcon = statusIcons[task.status] || '?';

  let output = `${prefix}${statusIcon} [${task.id}] ${task.description}\n`;

  if (task.result && task.status === 'completed') {
    output += `${prefix}  → ${task.result}\n`;
  }

  for (const subtask of task.subtasks || []) {
    output += formatTaskTreeForPrompt(subtask, indent + 1);
  }

  return output;
}

/**
 * Build hierarchical breakdown for report
 */
function buildHierarchicalBreakdown(task: any): any {
  return {
    taskId: task.id,
    description: task.description,
    status: task.status,
    result: task.result,
    subtasks: task.subtasks.map((st: any) => buildHierarchicalBreakdown(st)),
  };
}

/**
 * Calculate total execution time
 */
function calculateExecutionTime(task: any): number {
  if (task.executionStartTime && task.executionEndTime) {
    return task.executionEndTime.getTime() - task.executionStartTime.getTime();
  }

  // Sum execution times of subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    return task.subtasks.reduce((sum: number, st: any) => sum + calculateExecutionTime(st), 0);
  }

  return 0;
}
