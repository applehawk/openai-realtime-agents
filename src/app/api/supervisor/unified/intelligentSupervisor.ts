/**
 * IntelligentSupervisor - Unified Task Delegation System
 *
 * This class provides adaptive task delegation with automatic complexity assessment.
 * It replaces the manual decision-making in Router Agent between Path 4 and Path 5.
 *
 * Features:
 * - Automatic complexity assessment (simple/medium/complex)
 * - Adaptive strategy selection (direct/flat/hierarchical)
 * - Built-in progress tracking
 * - Unified response format
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { run } from '@openai/agents';
import { supervisorAgent } from '../agent';
import { TaskOrchestrator } from '../taskOrchestrator';
import {
  TaskBreakdownRequest,
  TaskBreakdownResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  ReportGenerationRequest,
  FinalReport,
} from '../taskTypes';

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex';

/**
 * Execution strategies
 */
export type ExecutionStrategy = 'direct' | 'flat' | 'hierarchical';

/**
 * Execution modes
 */
export type ExecutionMode = 'auto' | 'plan' | 'execute';

/**
 * Configuration for IntelligentSupervisor
 */
export interface IntelligentSupervisorConfig {
  enableProgressCallbacks?: boolean;
  maxComplexity?: 'flat' | 'hierarchical';
  maxNestingLevel?: number;
  maxSubtasksPerTask?: number;
}

/**
 * Request to IntelligentSupervisor
 */
export interface UnifiedRequest {
  taskDescription: string;
  conversationContext: string;
  executionMode?: ExecutionMode;
  history?: any[];
}

/**
 * Response from IntelligentSupervisor
 */
export interface UnifiedResponse {
  strategy: ExecutionStrategy;
  complexity: TaskComplexity;
  nextResponse: string;
  workflowSteps: string[];
  hierarchicalBreakdown?: any;
  progress: { current: number; total: number };
  executionTime: number;
  plannedSteps?: string[]; // If executionMode === 'plan'
}

/**
 * IntelligentSupervisor class - adaptive task delegation
 */
export class IntelligentSupervisor {
  private config: Required<IntelligentSupervisorConfig>;

  constructor(config?: IntelligentSupervisorConfig) {
    this.config = {
      enableProgressCallbacks: config?.enableProgressCallbacks ?? true,
      maxComplexity: config?.maxComplexity ?? 'hierarchical',
      maxNestingLevel: config?.maxNestingLevel ?? 5,
      maxSubtasksPerTask: config?.maxSubtasksPerTask ?? 10,
    };
  }

  /**
   * Execute a task with adaptive complexity
   */
  async execute(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();
    console.log('[IntelligentSupervisor] Starting execution:', request.taskDescription);

    const executionMode = request.executionMode || 'auto';

    // Step 1: Assess complexity
    const complexityAssessment = await this.assessComplexity(
      request.taskDescription,
      request.conversationContext
    );

    console.log('[IntelligentSupervisor] Complexity assessment:', complexityAssessment);

    // Step 2: Select strategy based on complexity and config
    const strategy = this.selectStrategy(complexityAssessment.complexity);

    console.log('[IntelligentSupervisor] Selected strategy:', strategy);

    // Step 3: Execute based on strategy and mode
    let result: UnifiedResponse;

    if (executionMode === 'plan') {
      // PLAN FIRST mode: return plan without execution
      result = await this.generatePlan(
        request,
        complexityAssessment.complexity,
        strategy
      );
    } else {
      // EXECUTE mode (auto or explicit)
      switch (strategy) {
        case 'direct':
          result = await this.executeDirectly(
            request,
            complexityAssessment.complexity
          );
          break;
        case 'flat':
          result = await this.executeFlatWorkflow(
            request,
            complexityAssessment.complexity
          );
          break;
        case 'hierarchical':
          result = await this.executeHierarchical(
            request,
            complexityAssessment.complexity
          );
          break;
      }
    }

    const executionTime = Date.now() - startTime;
    result.executionTime = executionTime;

    console.log('[IntelligentSupervisor] Execution complete:', {
      strategy: result.strategy,
      complexity: result.complexity,
      executionTime,
    });

    return result;
  }

  /**
   * Step 1: Assess task complexity using supervisorAgent
   */
  private async assessComplexity(
    taskDescription: string,
    conversationContext: string
  ): Promise<{ complexity: TaskComplexity; reasoning: string }> {
    console.log('[IntelligentSupervisor] Assessing complexity...');

    const assessmentPrompt = `
Оцени сложность следующей задачи:

**Задача:** ${taskDescription}

**Контекст разговора:** ${conversationContext}

---

**Твоя задача:**
Определи сложность задачи по следующим критериям:

**simple** (простая):
- 1 шаг, одно действие
- Все параметры известны
- Не требует условной логики
- Примеры: "Прочитай последнее письмо", "Покажи встречи на завтра"

**medium** (средняя):
- 2-7 шагов
- Может потребовать условную логику
- Нужна координация между шагами
- Примеры: "Прочитай письмо от Анны и назначь встречу", "Найди свободное время и создай событие"

**complex** (сложная):
- 8+ шагов
- Множественные источники данных
- Массовые операции (множество людей, событий)
- Требует иерархической декомпозиции
- Примеры: "Найди всех участников проекта и отправь приглашения", "Проанализируй всю переписку за месяц"

**Верни ТОЛЬКО валидный JSON:**
{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "Краткое объяснение оценки (1-2 предложения)"
}

**ВАЖНО:** Возвращай ТОЛЬКО JSON, без дополнительного текста!
`;

    try {
      const result = await run(supervisorAgent, assessmentPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[IntelligentSupervisor] No JSON in complexity assessment, defaulting to medium');
        return { complexity: 'medium', reasoning: 'Failed to parse assessment' };
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return {
        complexity: assessment.complexity || 'medium',
        reasoning: assessment.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] Complexity assessment error:', error);
      return { complexity: 'medium', reasoning: 'Error during assessment' };
    }
  }

  /**
   * Step 2: Select execution strategy based on complexity
   */
  private selectStrategy(complexity: TaskComplexity): ExecutionStrategy {
    if (complexity === 'simple') {
      return 'direct';
    }

    if (complexity === 'medium' || this.config.maxComplexity === 'flat') {
      return 'flat';
    }

    return 'hierarchical';
  }

  /**
   * Strategy 1: Direct execution (simple tasks)
   */
  private async executeDirectly(
    request: UnifiedRequest,
    complexity: TaskComplexity
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Executing directly (simple task)');

    const executionPrompt = `
Выполни простую задачу:

**Задача:** ${request.taskDescription}

**Контекст:** ${request.conversationContext}

---

**Твоя задача:**
Выполни задачу напрямую, используя доступные инструменты (MCP tools).

**Верни JSON:**
{
  "nextResponse": "Детальный ответ на русском (30-80 слов)",
  "workflowSteps": [
    "Шаг 1 (прошедшее время, 5-15 слов)"
  ]
}

**ВАЖНО:** Возвращай ТОЛЬКО JSON!
`;

    try {
      const result = await run(supervisorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in direct execution response');
      }

      const execution = JSON.parse(jsonMatch[0]);

      return {
        strategy: 'direct',
        complexity,
        nextResponse: execution.nextResponse || 'Задача выполнена',
        workflowSteps: execution.workflowSteps || [],
        progress: { current: 1, total: 1 },
        executionTime: 0,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] Direct execution error:', error);
      throw error;
    }
  }

  /**
   * Strategy 2: Flat workflow execution (medium tasks)
   * Uses existing supervisorAgent logic from Path 4
   */
  private async executeFlatWorkflow(
    request: UnifiedRequest,
    complexity: TaskComplexity
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Executing flat workflow (medium task)');

    // Reuse Path 4 logic: delegate to supervisorAgent with EXECUTE IMMEDIATELY mode
    const executionPrompt = `
Выполни задачу средней сложности:

**Задача:** ${request.taskDescription}

**Контекст:** ${request.conversationContext}

---

**Твоя задача:**
Выполни многошаговую задачу, используя доступные инструменты (MCP tools).

**Верни JSON:**
{
  "nextResponse": "Детальный ответ на русском (40-100+ слов)",
  "workflowSteps": [
    "Шаг 1 (прошедшее время, 5-15 слов)",
    "Шаг 2 (прошедшее время, 5-15 слов)",
    ...
  ]
}

**ВАЖНО:**
- nextResponse должен быть детальным и информативным
- workflowSteps ОБЯЗАТЕЛЬНЫ (минимум 2 шага)
- Возвращай ТОЛЬКО JSON!
`;

    try {
      const result = await run(supervisorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in flat workflow response');
      }

      const execution = JSON.parse(jsonMatch[0]);

      return {
        strategy: 'flat',
        complexity,
        nextResponse: execution.nextResponse || 'Задача выполнена',
        workflowSteps: execution.workflowSteps || [],
        progress: {
          current: execution.workflowSteps?.length || 0,
          total: execution.workflowSteps?.length || 0,
        },
        executionTime: 0,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] Flat workflow error:', error);
      throw error;
    }
  }

  /**
   * Strategy 3: Hierarchical execution (complex tasks)
   * Uses TaskOrchestrator from Path 5
   */
  private async executeHierarchical(
    request: UnifiedRequest,
    complexity: TaskComplexity
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Executing hierarchically (complex task)');

    const orchestrator = new TaskOrchestrator(
      {
        maxNestingLevel: this.config.maxNestingLevel,
        maxSubtasksPerTask: this.config.maxSubtasksPerTask,
        enableProgressCallbacks: this.config.enableProgressCallbacks,
      },
      (update) => {
        console.log(
          `[IntelligentSupervisor] Progress: ${update.type} - ${update.taskDescription} (${update.progress}%)`
        );
        // TODO: Send to SSE/WebSocket if needed
      }
    );

    const report: FinalReport = await orchestrator.executeComplexTask(
      request.taskDescription,
      request.conversationContext,
      this.breakdownTaskWithSupervisor.bind(this),
      this.executeSingleTaskWithAgent.bind(this),
      this.generateReportWithSupervisor.bind(this)
    );

    return {
      strategy: 'hierarchical',
      complexity,
      nextResponse: report.detailedResults,
      workflowSteps: this.extractWorkflowStepsFromHierarchy(report.hierarchicalBreakdown),
      hierarchicalBreakdown: report.hierarchicalBreakdown,
      progress: {
        current: report.tasksCompleted,
        total: report.tasksCompleted + report.tasksFailed,
      },
      executionTime: report.executionTime,
    };
  }

  /**
   * Generate plan without execution (PLAN FIRST mode)
   */
  private async generatePlan(
    request: UnifiedRequest,
    complexity: TaskComplexity,
    strategy: ExecutionStrategy
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Generating plan (PLAN FIRST mode)');

    const planPrompt = `
Составь план выполнения задачи:

**Задача:** ${request.taskDescription}

**Контекст:** ${request.conversationContext}

**Сложность:** ${complexity}

---

**Твоя задача:**
Составь детальный план выполнения БЕЗ реального выполнения.

**Верни JSON:**
{
  "nextResponse": "Представление плана пользователю на русском (40-80 слов) + вопрос 'Хотите, чтобы я выполнил этот план?'",
  "plannedSteps": [
    "Шаг 1 (будущее время, 10-20 слов)",
    "Шаг 2 (будущее время, 10-20 слов)",
    ...
  ]
}

**Примеры plannedSteps:**
- "Прочитаю письмо от Анны и извлеку предложенное время встречи"
- "Проверю ваш календарь на 15 января в 15:00 на наличие конфликтов"

**ВАЖНО:** Возвращай ТОЛЬКО JSON!
`;

    try {
      const result = await run(supervisorAgent, planPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in plan generation response');
      }

      const plan = JSON.parse(jsonMatch[0]);

      return {
        strategy,
        complexity,
        nextResponse: plan.nextResponse || 'План составлен',
        workflowSteps: [],
        plannedSteps: plan.plannedSteps || [],
        progress: { current: 0, total: plan.plannedSteps?.length || 0 },
        executionTime: 0,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] Plan generation error:', error);
      throw error;
    }
  }

  /**
   * Helper: Breakdown task using supervisorAgent (for hierarchical execution)
   */
  private async breakdownTaskWithSupervisor(
    request: TaskBreakdownRequest
  ): Promise<TaskBreakdownResponse> {
    const { task, conversationContext, previousResults } = request;

    const breakdownPrompt = `
Проанализируй задачу и реши, нужно ли разбить её на подзадачи.

**Задача:** ${task.description}
**Уровень вложенности:** ${task.level}
**Текущая сложность:** ${task.complexity}

${previousResults && previousResults.length > 0 ? `**Результаты предыдущих задач:**\n${previousResults.join('\n')}` : ''}

**Контекст беседы:**
${conversationContext}

---

**Верни ТОЛЬКО валидный JSON:**
{
  "shouldBreakdown": true/false,
  "reasoning": "Краткое объяснение (1-2 предложения)",
  "subtasks": [
    {
      "description": "Подзадача 1 (будущее время)",
      "estimatedComplexity": "simple" | "moderate" | "complex",
      "dependencies": [0]
    }
  ],
  "directExecution": {
    "canExecuteDirectly": true,
    "executor": "supervisor"
  }
}
`;

    try {
      const result = await run(supervisorAgent, breakdownPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          shouldBreakdown: false,
          reasoning: 'Failed to parse breakdown response',
          directExecution: { canExecuteDirectly: true, executor: 'supervisor' },
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[IntelligentSupervisor] Breakdown error:', error);
      return {
        shouldBreakdown: false,
        reasoning: 'Error during breakdown',
        directExecution: { canExecuteDirectly: true, executor: 'supervisor' },
      };
    }
  }

  /**
   * Helper: Execute single task using supervisorAgent (for hierarchical execution)
   */
  private async executeSingleTaskWithAgent(
    request: TaskExecutionRequest
  ): Promise<TaskExecutionResponse> {
    const { task, conversationContext, previousResults } = request;

    const executionPrompt = `
Выполни следующую задачу:

**Задача:** ${task.description}

${previousResults && previousResults.length > 0 ? `**Контекст выполненных задач:**\n${previousResults.join('\n')}\n` : ''}

**Оригинальный контекст беседы:**
${conversationContext}

---

**Верни JSON:**
{
  "status": "completed" | "failed",
  "result": "Детальный результат на русском (прошедшее время)",
  "error": "Сообщение об ошибке, если failed",
  "workflowSteps": ["Шаг 1", "Шаг 2"],
  "needsRefinement": false
}
`;

    try {
      const result = await run(supervisorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { status: 'failed', error: 'Failed to parse execution response' };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[IntelligentSupervisor] Task execution error:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper: Generate report using supervisorAgent (for hierarchical execution)
   */
  private async generateReportWithSupervisor(
    request: ReportGenerationRequest
  ): Promise<FinalReport> {
    const { rootTask, taskTree, conversationContext } = request;

    const reportPrompt = `
Сгенерируй финальный отчёт о выполнении сложной задачи.

**Оригинальная задача:** ${rootTask.description}

**Статистика:**
- Всего подзадач: ${taskTree.totalTasks}
- Успешно выполнено: ${taskTree.completedTasks}
- Провалено: ${taskTree.failedTasks}

---

**Верни JSON:**
{
  "summary": "Краткое резюме (2-3 предложения)",
  "detailedResults": "Детальное описание результатов (100-200+ слов)",
  "tasksCompleted": ${taskTree.completedTasks},
  "tasksFailed": ${taskTree.failedTasks},
  "executionTime": 0,
  "hierarchicalBreakdown": ${JSON.stringify(this.buildHierarchicalBreakdown(rootTask))}
}
`;

    try {
      const result = await run(supervisorAgent, reportPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          summary: 'Задача выполнена',
          detailedResults: 'Результаты доступны в иерархической структуре',
          tasksCompleted: taskTree.completedTasks,
          tasksFailed: taskTree.failedTasks,
          executionTime: 0,
          hierarchicalBreakdown: this.buildHierarchicalBreakdown(rootTask),
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[IntelligentSupervisor] Report generation error:', error);
      return {
        summary: 'Задача выполнена с ошибками',
        detailedResults: 'Произошла ошибка при генерации отчёта',
        tasksCompleted: taskTree.completedTasks,
        tasksFailed: taskTree.failedTasks,
        executionTime: 0,
        hierarchicalBreakdown: this.buildHierarchicalBreakdown(rootTask),
      };
    }
  }

  /**
   * Helper: Build hierarchical breakdown for report
   */
  private buildHierarchicalBreakdown(task: any): any {
    return {
      taskId: task.id,
      description: task.description,
      status: task.status,
      result: task.result,
      subtasks: task.subtasks?.map((st: any) => this.buildHierarchicalBreakdown(st)) || [],
    };
  }

  /**
   * Helper: Extract flat workflow steps from hierarchical breakdown
   */
  private extractWorkflowStepsFromHierarchy(hierarchy: any): string[] {
    const steps: string[] = [];

    const traverse = (node: any) => {
      if (node.result && node.status === 'completed') {
        steps.push(`${node.description}: ${node.result}`);
      }
      if (node.subtasks && node.subtasks.length > 0) {
        node.subtasks.forEach((subtask: any) => traverse(subtask));
      }
    };

    traverse(hierarchy);
    return steps;
  }
}
