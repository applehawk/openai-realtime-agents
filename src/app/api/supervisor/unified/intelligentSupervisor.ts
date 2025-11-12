/**
 * IntelligentSupervisor - Unified Task Delegation System
 *
 * This class provides adaptive task delegation with automatic complexity assessment.
 * It replaces the manual decision-making in Router Agent between Path 4 and Path 5.
 *
 * Features:
 * - Enhanced complexity assessment with delegation support (tooSimple/simple/medium/complex)
 * - Early return for tasks that primary agent can handle
 * - Adaptive strategy selection (direct/flat/hierarchical)
 * - Built-in progress tracking
 * - Unified response format
 *
 * Version: 3.2 (v3.2 - Enhanced Complexity Assessor)
 * Date: 2025-10-27
 * 
 * v3.2 Changes:
 * - ✅ Merged delegationReviewerAgent + complexityAssessorAgent → complexityAssessorAgent2
 * - Added 'tooSimple' complexity level for early delegation back
 * - One LLM call instead of two (saves ~300 tokens per task)
 * - Expanded delegation criteria: 2-7 sequential steps can be tooSimple
 * 
 * v3.1 Changes:
 * - Integrated delegationReviewerAgent as Step 0 (before complexity assessment)
 * - Enables early return for simple tasks that primary agent can handle
 * - Saves 50-70% tokens for simple tasks (no complexity/breakdown needed)
 * - Faster execution and better UX (fewer hops)
 * 
 * v3.0 Changes:
 * - Replaced monolithic supervisorAgent with 5 specialized agents
 * - Added delegationReviewerAgent for delegation decisions (MERGED in v3.2)
 * - Added complexityAssessorAgent for complexity assessment (ENHANCED in v3.2)
 * - Added taskPlannerAgent for PLAN FIRST mode
 * - Added workflowOrchestratorAgent for workflow execution
 * - Added reportGeneratorAgent for final reports
 * - Improved token efficiency (50-60% reduction)
 * - Enhanced accuracy through specialization (+10-15%)
 */

import { run } from '@openai/agents';
import {
  decisionAgent,
  executorAgent,
  taskPlannerAgent,
  workflowOrchestratorAgent,
  reportGeneratorAgent,
} from '../agent';
// Import new enhanced complexityAssessorAgent2 directly
import { complexityAssessorAgent2 } from '../agents/complexityAssessor2';
import { TaskOrchestrator } from '../taskOrchestrator';
import {
  TaskBreakdownRequest,
  TaskBreakdownResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  ReportGenerationRequest,
  FinalReport,
} from '../taskTypes';
import { progressEmitter, ProgressUpdate } from './progressEmitter';
import { taskContextStore } from './taskContextStore';
import {
  WORD_LIMITS,
  SENTENCE_LIMITS,
  LENGTH_DESCRIPTIONS,
} from '../constants';

/**
 * Task complexity levels
 * v3.2: Added 'tooSimple' for tasks that should delegate back to primary agent
 */
export type TaskComplexity = 'tooSimple' | 'simple' | 'medium' | 'complex';

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
  sessionId?: string; // For SSE progress tracking
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
  delegateBack?: boolean; // If true, task should be delegated back to primary agent
  delegationGuidance?: string | null; // Instructions for primary agent (if delegateBack === true)
}

/**
 * IntelligentSupervisor class - adaptive task delegation
 */
export class IntelligentSupervisor {
  private config: Required<IntelligentSupervisorConfig>;
  private sessionId: string;
  private isCompleted: boolean = false; // Flag to prevent emitting after completion

  constructor(config?: IntelligentSupervisorConfig) {
    this.config = {
      enableProgressCallbacks: config?.enableProgressCallbacks ?? true,
      maxComplexity: config?.maxComplexity ?? 'hierarchical',
      maxNestingLevel: config?.maxNestingLevel ?? 5,
      maxSubtasksPerTask: config?.maxSubtasksPerTask ?? 10,
      sessionId: config?.sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
    this.sessionId = this.config.sessionId;
  }

  /**
   * Emit progress update via SSE
   */
  private emitProgress(
    type: ProgressUpdate['type'],
    message: string,
    progress: number,
    details?: any
  ): void {
    // Don't emit if already completed
    if (this.isCompleted) {
      console.log(`[IntelligentSupervisor] Skipping emit - session ${this.sessionId} already completed`);
      return;
    }

    if (this.config.enableProgressCallbacks && this.sessionId) {
      progressEmitter.emitProgress({
        sessionId: this.sessionId,
        type,
        message,
        progress,
        details,
        timestamp: Date.now(),
      });

      // Mark as completed if this is a final event
      if (type === 'completed' || type === 'error') {
        this.isCompleted = true;
        console.log(`[IntelligentSupervisor] Session ${this.sessionId} marked as completed (type: ${type})`);
      }

      // Update task context store if details contain hierarchicalBreakdown
      if (details?.hierarchicalBreakdown) {
        taskContextStore.setContext(this.sessionId, {
          hierarchicalBreakdown: details.hierarchicalBreakdown,
          progress: {
            current: 0,
            total: 0,
            percentage: progress,
          },
          strategy: details.strategy,
          complexity: details.complexity,
        });
      }
    }
  }

  /**
   * Execute a task with adaptive complexity
   */
  async execute(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();
    console.log('[IntelligentSupervisor] Starting execution:', request.taskDescription);

    // Emit: Task started
    this.emitProgress('started', 'Начинаю выполнение задачи...', 0, {
      taskDescription: request.taskDescription,
    });

    const executionMode = request.executionMode || 'auto';

    // Step 1 (v3.2): Enhanced complexity assessment with delegation support
    this.emitProgress('complexity_assessed', 'Оцениваю сложность и необходимость делегации...', 10);
    const complexityAssessment = await this.assessComplexity(
      request.taskDescription,
      request.conversationContext
    );

    console.log('[IntelligentSupervisor] Complexity assessment:', complexityAssessment);
    this.emitProgress('complexity_assessed', `Сложность определена: ${complexityAssessment.complexity}`, 20, {
      complexity: complexityAssessment.complexity,
      reasoning: complexityAssessment.reasoning,
    });

    // If tooSimple, delegate back to primary agent (v3.2)
    if (complexityAssessment.complexity === 'tooSimple' && complexityAssessment.shouldDelegateBack) {
      console.log('[IntelligentSupervisor] ✅ Task is tooSimple - delegating back to primary agent');
      this.emitProgress('delegate_back', 'Задача может быть выполнена primary agent', 100, {
        guidance: complexityAssessment.guidance,
      });

      const executionTime = Date.now() - startTime;
      return {
        strategy: 'direct',
        complexity: 'tooSimple',
        nextResponse: complexityAssessment.guidance || 'Выполни задачу с помощью доступных инструментов',
        workflowSteps: ['Делегирую задачу обратно primary agent'],
        progress: { current: 1, total: 1 },
        executionTime,
        delegateBack: true,
        delegationGuidance: complexityAssessment.guidance,
      };
    }

    console.log('[IntelligentSupervisor] ✋ Handling task personally (complexity:', complexityAssessment.complexity, ')');

    // Step 2: Select strategy based on complexity and config
    const strategy = this.selectStrategy(complexityAssessment.complexity);

    console.log('[IntelligentSupervisor] Selected strategy:', strategy);
    this.emitProgress('strategy_selected', `Стратегия выбрана: ${strategy}`, 30, {
      strategy,
    });

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

    // Emit: Task completed with FULL RESULT
    this.emitProgress('completed', 'Задача выполнена успешно', 100, {
      strategy: result.strategy,
      complexity: result.complexity,
      executionTime,
      workflowStepsCount: result.workflowSteps?.length || 0,
      // IMPORTANT: hierarchicalBreakdown at top level for taskContextStore
      hierarchicalBreakdown: result.hierarchicalBreakdown,
      // Include full result for client
      finalResult: {
        strategy: result.strategy,
        complexity: result.complexity,
        nextResponse: result.nextResponse,
        workflowSteps: result.workflowSteps,
        hierarchicalBreakdown: result.hierarchicalBreakdown,
        progress: result.progress,
        executionTime: result.executionTime,
        plannedSteps: result.plannedSteps,
        delegateBack: result.delegateBack,
        delegationGuidance: result.delegationGuidance,
      },
    });

    return result;
  }


  /**
   * Step 1: Enhanced complexity assessment with delegation support (v3.2)
   * 
   * v3.2: Uses complexityAssessorAgent2 which combines delegation + complexity
   * - Returns 'tooSimple' for tasks that should delegate back
   * - Includes guidance for primary agent when delegating
   * - One LLM call instead of two (saves ~300 tokens)
   */
  private async assessComplexity(
    taskDescription: string,
    conversationContext: string
  ): Promise<{
    complexity: TaskComplexity;
    reasoning: string;
    shouldDelegateBack?: boolean;
    guidance?: string;
  }> {
    console.log('[IntelligentSupervisor] Assessing complexity with enhanced ComplexityAssessorAgent2...');

    const assessmentPrompt = `
**Task:** ${taskDescription}

**Conversation Context:** 
${conversationContext.slice(0, 500)}${conversationContext.length > 500 ? '...' : ''}

Assess if this task should delegate back to primary agent (tooSimple) or determine complexity level.
`;

    try {
      const result = await run(complexityAssessorAgent2, assessmentPrompt);
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
      
      console.log('[IntelligentSupervisor] Enhanced complexity assessed:', {
        complexity: assessment.complexity,
        shouldDelegateBack: assessment.shouldDelegateBack,
        estimatedSteps: assessment.estimatedSteps,
        reasoning: assessment.reasoning,
        hasGuidance: !!assessment.guidance,
      });
      
      return {
        complexity: assessment.complexity || 'medium',
        reasoning: assessment.reasoning || 'No reasoning provided',
        shouldDelegateBack: assessment.shouldDelegateBack || false,
        guidance: assessment.guidance || null,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] ComplexityAssessorAgent2 error:', error);
      return { complexity: 'medium', reasoning: 'Error during assessment' };
    }
  }

  /**
   * Step 2: Select execution strategy based on complexity
   */
  private selectStrategy(complexity: TaskComplexity): ExecutionStrategy {
    // tooSimple should not reach here (early return), but handle just in case
    if (complexity === 'tooSimple' || complexity === 'simple') {
      return 'direct';
    }

    if (complexity === 'medium' || this.config.maxComplexity === 'flat') {
      return 'flat';
    }

    return 'hierarchical';
  }

  /**
   * Strategy 1: Direct execution (simple tasks) using WorkflowOrchestratorAgent (v3.0)
   * 
   * WHY WorkflowOrchestrator?
   * - ROOT LEVEL task (user's direct request)
   * - NO context from other tasks
   * - Simple task that doesn't need decomposition
   * - Agent plans and executes independently
   * 
   * v3.0: Now uses specialized WorkflowOrchestratorAgent
   * Token savings: ~2100 tokens per call (vs supervisorAgent)
   */
  private async executeDirectly(
    request: UnifiedRequest,
    complexity: TaskComplexity
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Executing directly with WorkflowOrchestratorAgent (ROOT LEVEL, simple task)...');
    
    this.emitProgress('step_started', 'Выполняю простую задачу...', 40);

    // v3.0: Simplified prompt - agent already knows how to execute workflows
    const executionPrompt = `
**Task:** ${request.taskDescription}

**Conversation Context:**
${request.conversationContext.slice(0, 800)}${request.conversationContext.length > 800 ? '...' : ''}

Execute this simple task directly using MCP tools.
`;

    try {
      const result = await run(workflowOrchestratorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in direct execution response');
      }

      const execution = JSON.parse(jsonMatch[0]);

      console.log('[IntelligentSupervisor] Direct execution completed:', {
        status: execution.status,
        stepsCount: execution.workflowSteps?.length || 0,
        toolsUsed: execution.toolsUsed?.length || 0,
      });

      const taskTree = {
        taskId: 'task-root',
        description: request.taskDescription,
        status: execution.status === 'completed' ? 'completed' as const : 'failed' as const,
        complexity: 'simple' as const,
        executionStrategy: 'direct' as const,
        result: execution.result,
        subtasks: [],
      };

      this.emitProgress('step_completed', 'Простая задача выполнена', 90, {
        workflowSteps: execution.workflowSteps,
        hierarchicalBreakdown: taskTree,
        strategy: 'direct',
        complexity: 'simple',
      });

      return {
        strategy: 'direct',
        complexity,
        nextResponse: execution.result || 'Задача выполнена',
        workflowSteps: execution.workflowSteps || [],
        hierarchicalBreakdown: taskTree,
        progress: { current: 1, total: 1 },
        executionTime: parseFloat(execution.executionTime) || 0,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] WorkflowOrchestrator error (direct):', error);
      this.emitProgress('error', `Ошибка выполнения: ${error instanceof Error ? error.message : 'Unknown'}`, 0, { error });
      throw error;
    }
  }

  /**
   * Strategy 2: Flat workflow execution (medium tasks) using WorkflowOrchestratorAgent (v3.0)
   * 
   * WHY WorkflowOrchestrator?
   * - ROOT LEVEL task (user's direct request)
   * - NO context from other tasks
   * - Medium complexity workflow (3-5 sequential steps)
   * - Agent plans multi-step workflow independently
   * - Handles conditional logic and data synthesis
   * 
   * v3.0: Now uses specialized WorkflowOrchestratorAgent for multi-step coordination
   * Token savings: ~2050 tokens per call (vs supervisorAgent)
   */
  private async executeFlatWorkflow(
    request: UnifiedRequest,
    complexity: TaskComplexity
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Executing flat workflow with WorkflowOrchestratorAgent (ROOT LEVEL, medium task)...');
    
    this.emitProgress('step_started', 'Выполняю многошаговую задачу...', 40);

    // v3.0: Simplified prompt - agent knows how to orchestrate multi-step workflows
    const executionPrompt = `
**Task (Medium Complexity):** ${request.taskDescription}

**Conversation Context:**
${request.conversationContext.slice(0, 800)}${request.conversationContext.length > 800 ? '...' : ''}

Execute this multi-step workflow using MCP tools. Provide comprehensive results (${LENGTH_DESCRIPTIONS.COMPREHENSIVE_SUMMARY}).
`;

    try {
      const result = await run(workflowOrchestratorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in flat workflow response');
      }

      const execution = JSON.parse(jsonMatch[0]);

      const stepCount = execution.workflowSteps?.length || 0;
      
      console.log('[IntelligentSupervisor] Flat workflow completed:', {
        status: execution.status,
        stepsCount: stepCount,
        toolsUsed: execution.toolsUsed?.length || 0,
      });
      
      const subtasks = (execution.workflowSteps || []).map((step: string, idx: number) => ({
        taskId: `task-root.${idx}`,
        description: step,
        status: 'completed' as const,
        complexity: 'simple' as const,
        result: step,
      }));
      
      const taskTree = {
        taskId: 'task-root',
        description: request.taskDescription,
        status: execution.status === 'completed' ? 'completed' as const : 'failed' as const,
        complexity: 'medium' as const,
        executionStrategy: 'flat' as const,
        result: execution.result,
        subtasks,
      };

      this.emitProgress('step_completed', `Многошаговая задача выполнена (${stepCount} шагов)`, 90, {
        workflowSteps: execution.workflowSteps,
        stepCount,
        hierarchicalBreakdown: taskTree,
        strategy: 'flat',
        complexity: 'medium',
      });

      return {
        strategy: 'flat',
        complexity,
        nextResponse: execution.result || 'Задача выполнена',
        workflowSteps: execution.workflowSteps || [],
        hierarchicalBreakdown: taskTree,
        progress: {
          current: execution.workflowSteps?.length || 0,
          total: execution.workflowSteps?.length || 0,
        },
        executionTime: parseFloat(execution.executionTime) || 0,
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] WorkflowOrchestrator error (flat):', error);
      this.emitProgress('error', `Ошибка выполнения: ${error instanceof Error ? error.message : 'Unknown'}`, 0, { error });
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
    this.emitProgress('step_started', 'Выполняю сложную задачу с иерархической декомпозицией...', 40);

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
        
        // Forward TaskOrchestrator progress to SSE
        const progress = 40 + Math.floor((update.progress / 100) * 50); // Map 0-100 to 40-90
        
        // Send tree update for all important events
        if (update.rootTask && (
          update.type === 'breakdown_completed' ||
          update.type === 'task_started' ||
          update.type === 'task_completed' ||
          update.type === 'task_failed'
        )) {
          const hierarchicalBreakdown = this.buildHierarchicalBreakdown(update.rootTask);
          console.log(`[IntelligentSupervisor] Sending tree update after ${update.type}:`, update.taskId);

          // Map event types to user-friendly messages
          // Include taskId to make messages unique (prevents deduplication of different tasks)
          const messages = {
            'breakdown_completed': `Декомпозиция завершена: ${update.taskDescription} [${update.taskId}]`,
            'task_started': `Начато выполнение: ${update.taskDescription} [${update.taskId}]`,
            'task_completed': `Завершено: ${update.taskDescription} [${update.taskId}]`,
            'task_failed': `Ошибка: ${update.taskDescription} [${update.taskId}]`,
          };

          this.emitProgress(
            'step_started',
            messages[update.type] || update.taskDescription,
            progress,
            {
              orchestratorUpdate: update,
              hierarchicalBreakdown,
              taskId: update.taskId,
              eventType: update.type,
            }
          );
        } else {
          // Other progress updates (breakdown_started)
          // Include taskId to make messages unique
          this.emitProgress('step_started', `${update.type}: ${update.taskDescription} [${update.taskId || 'root'}]`, progress, {
            orchestratorUpdate: update,
          });
        }
      }
    );

    const report: FinalReport = await orchestrator.executeComplexTask(
      request.taskDescription,
      request.conversationContext,
      this.breakdownTaskWithSupervisor.bind(this),
      this.executeSingleTaskWithAgent.bind(this),
      this.generateReportWithSupervisor.bind(this)
    );

    this.emitProgress('step_completed', `Сложная задача выполнена: ${report.tasksCompleted} подзадач`, 90, {
      tasksCompleted: report.tasksCompleted,
      tasksFailed: report.tasksFailed,
      executionTime: report.executionTime,
      hierarchicalBreakdown: report.hierarchicalBreakdown,
    });

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
   * Generate plan without execution (PLAN FIRST mode) using TaskPlannerAgent (v3.0)
   * 
   * v3.0: Now uses specialized TaskPlannerAgent for high-quality plan generation
   * Token savings: ~2150 tokens per call (vs supervisorAgent)
   */
  private async generatePlan(
    request: UnifiedRequest,
    complexity: TaskComplexity,
    strategy: ExecutionStrategy
  ): Promise<UnifiedResponse> {
    console.log('[IntelligentSupervisor] Generating plan with TaskPlannerAgent (PLAN FIRST mode)...');

    // v3.0: Simplified prompt - agent knows how to generate plans
    const planPrompt = `
**Task:** ${request.taskDescription}

**Conversation Context:**
${request.conversationContext.slice(0, 800)}${request.conversationContext.length > 800 ? '...' : ''}

**Complexity:** ${complexity}

Generate detailed execution plan WITHOUT executing. Present plan to user for confirmation.
`;

    try {
      const result = await run(taskPlannerAgent, planPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in plan generation response');
      }

      const plan = JSON.parse(jsonMatch[0]);

      console.log('[IntelligentSupervisor] Plan generated:', {
        stepsCount: plan.plannedSteps?.length || 0,
        estimatedTime: plan.estimatedTime,
        requiresConfirmation: plan.requiresUserConfirmation,
      });

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
      console.error('[IntelligentSupervisor] TaskPlannerAgent error:', error);
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
🚨 КРИТИЧЕСКИ ВАЖНО: Декомпозиция — дорогостоящая операция! Используй её ТОЛЬКО В КРАЙНЕМ СЛУЧАЕ! 🚨

**Задача:** ${task.description}
**Уровень вложенности:** ${task.level}
**Текущая сложность:** ${task.complexity}

${previousResults && previousResults.length > 0 ? `**Результаты предыдущих задач:**\n${previousResults.join('\n')}` : ''}

**Контекст беседы:**
${conversationContext}

---

**ПРАВИЛО ПО УМОЛЧАНИЮ: НЕ РАЗБИВАТЬ!**

❌ **НЕ РАЗБИВАЙ** если:
- Задача выполняется в 1-3 простых шага
- Вся информация есть или получается одним вызовом
- Агент может выполнить всё сразу последовательно
- Есть контекст из previousResults

✅ **РАЗБИВАЙ ТОЛЬКО** если:
- 5+ различных операций в разных доменах
- Сложная условная логика с ветвлениями
- Итерация по большому набору данных (20+ элементов)
- Требуется несколько подтверждений от пользователя

**ПРИМЕРЫ:**
- "Прочитай письмо и назначь встречу" → ❌ НЕ РАЗБИВАТЬ (2 шага, агент справится)
- "Найди свободное время и создай событие" → ❌ НЕ РАЗБИВАТЬ (простая задача)
- "Найди 50 участников проекта и каждому отправь персональное приглашение" → ✅ РАЗБИТЬ (большой объём)

---

**Верни ТОЛЬКО валидный JSON:**
{
  "shouldBreakdown": false,
  "reasoning": "Задача выполняется в 2-3 шага, агент справится напрямую без декомпозиции",
  "directExecution": {
    "canExecuteDirectly": true,
    "executor": "supervisor"
  }
}

OR (редко!):

{
  "shouldBreakdown": true,
  "reasoning": "Задача требует 5+ операций: найти 50 участников, проверить доступность каждого, отправить персональные приглашения",
  "subtasks": [
    {
      "description": "Найти всех участников проекта Восток",
      "estimatedComplexity": "moderate",
      "dependencies": []
    }
  ]
}
`;

    try {
      // NEW (v2.0): Use specialized DecisionAgent instead of supervisorAgent
      const result = await run(decisionAgent, breakdownPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[IntelligentSupervisor] DecisionAgent returned no JSON, defaulting to NO breakdown');
        return {
          shouldBreakdown: false,
          reasoning: 'Failed to parse breakdown response - defaulting to direct execution',
          directExecution: { canExecuteDirectly: true, executor: 'supervisor' },
        };
      }

      const decision = JSON.parse(jsonMatch[0]);
      
      console.log('[IntelligentSupervisor] DecisionAgent decision:', {
        shouldBreakdown: decision.shouldBreakdown,
        reasoning: decision.reasoning,
        subtasksCount: decision.subtasks?.length || 0,
      });

      return decision;
    } catch (error) {
      console.error('[IntelligentSupervisor] DecisionAgent error:', error);
      // Default to NO breakdown on error (safer, cheaper)
      return {
        shouldBreakdown: false,
        reasoning: 'Error during breakdown - defaulting to direct execution',
        directExecution: { canExecuteDirectly: true, executor: 'supervisor' },
      };
    }
  }

  /**
   * Helper: Execute single task using ExecutorAgent (for hierarchical execution)
   * 
   * WHY ExecutorAgent?
   * - INSIDE HIERARCHY (complex root task decomposed into subtasks)
   * - HAS CONTEXT from parent/sibling tasks (previousResults, subtaskResults)
   * - Either LEAF task execution OR AGGREGATION of subtask results
   * - Works at ANY nesting level (1, 2, 3, etc.)
   * - Uses accumulated context for better decisions
   * 
   * ExecutorAgent has TWO modes:
   * 1. Aggregation: if task.subtaskResults exists → synthesize results
   * 2. Leaf execution: if NO subtaskResults → execute task directly (can do 2-3 step workflows)
   * 
   * NEW (v2.0): Use specialized ExecutorAgent optimized for hierarchical execution
   */
  private async executeSingleTaskWithAgent(
    request: TaskExecutionRequest
  ): Promise<TaskExecutionResponse> {
    const { task, conversationContext, previousResults } = request;

    console.log('[IntelligentSupervisor] Executing with ExecutorAgent (HIERARCHICAL, level=' + task.level + '):', {
      task: task.description,
      hasSubtaskResults: !!task.subtaskResults,
      hasPreviousResults: !!previousResults && previousResults.length > 0,
      mode: task.subtaskResults ? 'AGGREGATION' : 'LEAF EXECUTION',
    });

    const executionPrompt = `
**Task to Execute:**
${task.description}

${task.subtaskResults && task.subtaskResults.length > 0 ? `
**Subtask Results (aggregate these):**
${task.subtaskResults.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Your job: Synthesize these subtask results into a comprehensive answer to the main task.
` : ''}

${previousResults && previousResults.length > 0 ? `
**Previous Task Results (context):**
${previousResults.join('\n')}
` : ''}

**Original Conversation Context:**
${conversationContext}

---

**Return JSON:**
{
  "status": "completed" | "failed",
  "result": "Detailed result in Russian (past tense)",
  "error": "Error message if failed",
  "workflowSteps": ["Step 1", "Step 2"],
  "needsRefinement": false
}
`;

    try {
      // NEW (v2.0): Use specialized ExecutorAgent instead of supervisorAgent
      const result = await run(executorAgent, executionPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { status: 'failed', error: 'Failed to parse execution response' };
      }

      const response = JSON.parse(jsonMatch[0]);
      
      console.log('[IntelligentSupervisor] ExecutorAgent completed:', {
        status: response.status,
        stepsCount: response.workflowSteps?.length || 0,
      });

      return response;
    } catch (error) {
      console.error('[IntelligentSupervisor] ExecutorAgent error:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper: Generate report using ReportGeneratorAgent (v3.0)
   * 
   * v3.0: Now uses specialized ReportGeneratorAgent for comprehensive report synthesis
   * Token savings: ~2250 tokens per call (vs supervisorAgent)
   */
  private async generateReportWithSupervisor(
    request: ReportGenerationRequest
  ): Promise<FinalReport> {
    const { rootTask, taskTree, conversationContext } = request;

    console.log('[IntelligentSupervisor] Generating final report with ReportGeneratorAgent...');

    // Collect all subtask results
    const subtaskResults: string[] = [];
    const collectResults = (task: any) => {
      if (task.result && task.status === 'completed') {
        subtaskResults.push(`${task.description}: ${task.result}`);
      }
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((st: any) => collectResults(st));
      }
    };
    collectResults(rootTask);

    // v3.0: Simplified prompt - agent knows how to synthesize reports
    const reportPrompt = `
**Root Task:** ${rootTask.description}

**Subtask Results:**
${subtaskResults.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**Execution Metadata:**
- Total tasks: ${taskTree.totalTasks}
- Completed: ${taskTree.completedTasks}
- Failed: ${taskTree.failedTasks}

**Conversation Context:**
${conversationContext.slice(0, 500)}${conversationContext.length > 500 ? '...' : ''}

Synthesize comprehensive final report from all subtask results.
`;

    try {
      const result = await run(reportGeneratorAgent, reportPrompt);
      const content =
        typeof result.finalOutput === 'string'
          ? result.finalOutput
          : JSON.stringify(result.finalOutput);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[IntelligentSupervisor] No JSON in report, using default');
        return {
          summary: 'Задача выполнена',
          detailedResults: 'Результаты доступны в иерархической структуре',
          tasksCompleted: taskTree.completedTasks,
          tasksFailed: taskTree.failedTasks,
          executionTime: 0,
          hierarchicalBreakdown: this.buildHierarchicalBreakdown(rootTask),
        };
      }

      const report = JSON.parse(jsonMatch[0]);

      console.log('[IntelligentSupervisor] Report generated:', {
        tasksCompleted: report.executionSummary?.tasksCompleted,
        keyFindingsCount: report.keyFindings?.length || 0,
        detailedResultsLength: report.detailedResults?.length || 0,
      });

      return {
        summary: report.nextResponse || report.detailedResults?.slice(0, 200) || 'Задача выполнена',
        detailedResults: report.detailedResults || 'Результаты доступны в иерархической структуре',
        tasksCompleted: report.executionSummary?.tasksCompleted || taskTree.completedTasks,
        tasksFailed: report.executionSummary?.tasksFailed || taskTree.failedTasks,
        executionTime: parseFloat(report.executionSummary?.totalDuration) || 0,
        hierarchicalBreakdown: this.buildHierarchicalBreakdown(rootTask),
      };
    } catch (error) {
      console.error('[IntelligentSupervisor] ReportGeneratorAgent error:', error);
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
