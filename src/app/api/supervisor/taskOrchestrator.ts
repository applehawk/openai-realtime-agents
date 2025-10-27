/**
 * Task Orchestrator - Hierarchical Task Execution Engine
 *
 * This orchestrator manages the execution of complex tasks by:
 * 1. Breaking down complex tasks into subtasks recursively
 * 2. Executing tasks in correct order (respecting dependencies)
 * 3. Collecting results hierarchically
 * 4. Generating final report
 *
 * Version: 1.0
 * Date: 2025-10-22
 */

import {
  Task,
  TaskTree,
  TaskStatus,
  TaskComplexity,
  TaskBreakdownRequest,
  TaskBreakdownResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  ReportGenerationRequest,
  FinalReport,
  TaskManager,
} from './taskTypes';

/**
 * Configuration for task orchestrator
 */
export interface OrchestratorConfig {
  maxNestingLevel: number;              // Maximum task nesting depth (default: 5)
  maxSubtasksPerTask: number;           // Maximum subtasks per task (default: 10)
  minTaskComplexityForBreakdown: TaskComplexity; // Minimum complexity to break down
  enableProgressCallbacks: boolean;     // Enable real-time progress updates
}

/**
 * Progress callback for UI updates
 */
export type ProgressCallback = (update: {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'breakdown_started' | 'breakdown_completed';
  taskId: string;
  taskDescription: string;
  progress: number;                     // 0-100
  currentTask?: string;                 // Description of current task
  result?: string;                      // Result if completed
  task?: Task;                          // Current task with subtasks (for breakdown_completed)
  rootTask?: Task;                      // Root task with full hierarchy (for breakdown_completed)
}) => void;

/**
 * Main orchestrator class
 */
export class TaskOrchestrator {
  private config: OrchestratorConfig;
  private progressCallback?: ProgressCallback;
  private rootTask?: Task; // Reference to root task for progress callbacks

  constructor(config?: Partial<OrchestratorConfig>, progressCallback?: ProgressCallback) {
    this.config = {
      maxNestingLevel: config?.maxNestingLevel ?? 5,
      maxSubtasksPerTask: config?.maxSubtasksPerTask ?? 10,
      minTaskComplexityForBreakdown: config?.minTaskComplexityForBreakdown ?? 'moderate',
      enableProgressCallbacks: config?.enableProgressCallbacks ?? true,
    };
    this.progressCallback = progressCallback;
  }

  /**
   * Execute a complex task from start to finish
   *
   * NEW LOGIC (v2.0):
   * - Execute recursively (not break down everything first)
   * - Decompose only when needed
   * - Use subtask results as context for parent task
   * - Minimize unnecessary decomposition (expensive!)
   */
  async executeComplexTask(
    taskDescription: string,
    conversationContext: string,
    breakdownFn: (req: TaskBreakdownRequest) => Promise<TaskBreakdownResponse>,
    executeFn: (req: TaskExecutionRequest) => Promise<TaskExecutionResponse>,
    reportFn: (req: ReportGenerationRequest) => Promise<FinalReport>
  ): Promise<FinalReport> {
    console.log('[TaskOrchestrator] Starting complex task execution:', taskDescription);

    // 1. Create root task
    const rootTask: Task = {
      id: 'task-root',
      parentId: null,
      description: taskDescription,
      complexity: 'complex',
      status: 'planned',
      level: 0,
      subtasks: [],
    };

    // Store root task reference for progress callbacks
    this.rootTask = rootTask;

    // 2. Initialize task tree
    const taskTree: TaskTree = {
      rootTask,
      allTasks: new Map([[rootTask.id, rootTask]]),
      executionOrder: [],
      currentTaskId: null,
      totalTasks: 1,
      completedTasks: 0,
      failedTasks: 0,
      conversationHistory: [conversationContext],
    };

    // 3. Execute root task RECURSIVELY
    // This will handle decomposition, execution, and context accumulation
    await this.executeTaskRecursively(rootTask, taskTree, conversationContext, breakdownFn, executeFn);

    // 4. Generate final report
    const report = await this.generateFinalReport(taskTree, conversationContext, reportFn);

    console.log('[TaskOrchestrator] Task execution complete:', {
      completed: taskTree.completedTasks,
      failed: taskTree.failedTasks,
      total: taskTree.totalTasks,
    });

    return report;
  }

  /**
   * Execute task recursively with context accumulation
   * 
   * NEW APPROACH (v2.0):
   * 1. Ask supervisor: does this task need decomposition?
   * 2. If NO → execute directly
   * 3. If YES → decompose → execute subtasks → collect context → execute parent task with context
   */
  private async executeTaskRecursively(
    task: Task,
    taskTree: TaskTree,
    conversationContext: string,
    breakdownFn: (req: TaskBreakdownRequest) => Promise<TaskBreakdownResponse>,
    executeFn: (req: TaskExecutionRequest) => Promise<TaskExecutionResponse>
  ): Promise<void> {
    console.log(`[TaskOrchestrator] Executing task recursively: ${task.id} - ${task.description}`);

    // Check nesting level limit
    if (task.level >= this.config.maxNestingLevel) {
      console.log(`[TaskOrchestrator] Max nesting level reached for task ${task.id}, executing directly`);
      await this.executeTaskDirectly(task, taskTree, conversationContext, executeFn);
      return;
    }

    // Ask supervisor: should we break down this task?
    this.notifyProgress({
      type: 'breakdown_started',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
    });

    const breakdownRequest: TaskBreakdownRequest = {
      task,
      conversationContext,
      previousResults: task.parentId
        ? taskTree.allTasks.get(task.parentId)?.subtaskResults
        : undefined,
    };

    console.log(`[TaskOrchestrator] Requesting breakdown decision for task ${task.id}`);
    const breakdown = await breakdownFn(breakdownRequest);

    // CASE 1: Task doesn't need breakdown → execute directly
    if (!breakdown.shouldBreakdown) {
      console.log(`[TaskOrchestrator] Task ${task.id} doesn't need breakdown, executing directly`);
      await this.executeTaskDirectly(task, taskTree, conversationContext, executeFn);
      return;
    }

    // CASE 2: Task needs breakdown → decompose, execute subtasks, gather context, execute parent
    if (!breakdown.subtasks || breakdown.subtasks.length === 0) {
      console.log(`[TaskOrchestrator] No subtasks provided for task ${task.id}, executing directly`);
      await this.executeTaskDirectly(task, taskTree, conversationContext, executeFn);
      return;
    }

    // Decompose: Create subtasks
    const subtaskDescriptions = breakdown.subtasks.slice(0, this.config.maxSubtasksPerTask);
    console.log(`[TaskOrchestrator] Breaking down task ${task.id} into ${subtaskDescriptions.length} subtasks`);

    for (let i = 0; i < subtaskDescriptions.length; i++) {
      const subtaskDesc = subtaskDescriptions[i];
      const subtaskId = TaskManager.generateTaskId(task.id, i);

      const subtask: Task = {
        id: subtaskId,
        parentId: task.id,
        description: subtaskDesc.description,
        complexity: subtaskDesc.estimatedComplexity,
        status: 'planned',
        level: task.level + 1,
        subtasks: [],
        dependencies: subtaskDesc.dependencies?.map(depIdx =>
          TaskManager.generateTaskId(task.id, depIdx)
        ),
      };

      task.subtasks.push(subtask);
      taskTree.allTasks.set(subtaskId, subtask);
    }

    // Notify: breakdown completed
    this.notifyProgress({
      type: 'breakdown_completed',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
      task: task,
      rootTask: this.rootTask,
    });

    // Execute subtasks recursively (each may decompose further)
    const subtaskResults: string[] = [];
    for (const subtask of task.subtasks) {
      await this.executeTaskRecursively(subtask, taskTree, conversationContext, breakdownFn, executeFn);
      
      // Collect result from completed subtask
      if (subtask.status === 'completed' && subtask.result) {
        subtaskResults.push(`${subtask.description}: ${subtask.result}`);
      }
    }

    // Store subtask results for parent task execution
    task.subtaskResults = subtaskResults;

    // NOW execute parent task WITH CONTEXT from subtasks
    console.log(`[TaskOrchestrator] Executing parent task ${task.id} with context from ${subtaskResults.length} subtasks`);
    await this.executeTaskDirectly(task, taskTree, conversationContext, executeFn);
  }

  /**
   * Execute task directly (without decomposition)
   */
  private async executeTaskDirectly(
    task: Task,
    taskTree: TaskTree,
    conversationContext: string,
    executeFn: (req: TaskExecutionRequest) => Promise<TaskExecutionResponse>
  ): Promise<void> {
    console.log(`[TaskOrchestrator] Executing task directly: ${task.id}`);

    // Mark as in progress
    task.status = 'in_progress';
    task.executionStartTime = new Date();
    taskTree.currentTaskId = task.id;

    // Notify progress with tree update
    this.notifyProgress({
      type: 'task_started',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
      currentTask: task.description,
      task: task,
      rootTask: this.rootTask,
    });

    // Build execution context from subtask results
    const subtaskContext = task.subtaskResults?.length
      ? `\n\nКонтекст из подзадач:\n${task.subtaskResults.join('\n')}`
      : '';

    // Execute task with accumulated context
    const executionRequest: TaskExecutionRequest = {
      task,
      conversationContext: conversationContext + subtaskContext,
      previousResults: task.subtaskResults,
      siblingContext: task.subtaskResults?.join('\n'),
    };

    try {
      const response = await executeFn(executionRequest);

      if (response.status === 'completed') {
        task.status = 'completed';
        task.result = response.result;
        task.executionEndTime = new Date();
        taskTree.completedTasks++;

        console.log(`[TaskOrchestrator] Task ${task.id} completed successfully`);

        // Notify progress with tree update
        this.notifyProgress({
          type: 'task_completed',
          taskId: task.id,
          taskDescription: task.description,
          progress: TaskManager.calculateProgress(taskTree),
          result: response.result,
          task: task,
          rootTask: this.rootTask,
        });

        // Update parent's subtask results
        if (task.parentId) {
          const parent = taskTree.allTasks.get(task.parentId);
          if (parent) {
            if (!parent.subtaskResults) parent.subtaskResults = [];
            parent.subtaskResults.push(`${task.description}: ${task.result}`);
          }
        }
      } else {
        // Task failed
        task.status = 'failed';
        task.error = response.error || 'Unknown error';
        task.executionEndTime = new Date();
        taskTree.failedTasks++;

        console.error(`[TaskOrchestrator] Task ${task.id} failed:`, response.error);

        // Notify progress with tree update
        this.notifyProgress({
          type: 'task_failed',
          taskId: task.id,
          taskDescription: task.description,
          progress: TaskManager.calculateProgress(taskTree),
          task: task,
          rootTask: this.rootTask,
        });
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.executionEndTime = new Date();
      taskTree.failedTasks++;

      console.error(`[TaskOrchestrator] Task ${task.id} execution error:`, error);

      this.notifyProgress({
        type: 'task_failed',
        taskId: task.id,
        taskDescription: task.description,
        progress: TaskManager.calculateProgress(taskTree),
        task: task,
        rootTask: this.rootTask,
      });
    }
  }

  /**
   * Recursively break down a task into subtasks
   * 
   * @deprecated - Use executeTaskRecursively instead (v2.0)
   */
  private async breakdownTaskRecursively(
    task: Task,
    taskTree: TaskTree,
    conversationContext: string,
    breakdownFn: (req: TaskBreakdownRequest) => Promise<TaskBreakdownResponse>
  ): Promise<void> {
    // Check nesting level limit
    if (task.level >= this.config.maxNestingLevel) {
      console.log(`[TaskOrchestrator] Max nesting level reached for task ${task.id}, treating as leaf`);
      return;
    }

    // Check if task complexity warrants breakdown
    if (task.complexity === 'simple') {
      console.log(`[TaskOrchestrator] Task ${task.id} is simple, no breakdown needed`);
      return;
    }

    // Notify progress
    this.notifyProgress({
      type: 'breakdown_started',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
    });

    // Request breakdown from supervisor
    const breakdownRequest: TaskBreakdownRequest = {
      task,
      conversationContext,
      previousResults: task.parentId
        ? taskTree.allTasks.get(task.parentId)?.subtaskResults
        : undefined,
    };

    console.log(`[TaskOrchestrator] Requesting breakdown for task ${task.id}`);
    const breakdown = await breakdownFn(breakdownRequest);

    if (!breakdown.shouldBreakdown) {
      console.log(`[TaskOrchestrator] Task ${task.id} does not need breakdown`);
      // Update complexity based on supervisor's assessment
      if (breakdown.directExecution?.canExecuteDirectly) {
        task.complexity = 'simple';
      }
      return;
    }

    if (!breakdown.subtasks || breakdown.subtasks.length === 0) {
      console.log(`[TaskOrchestrator] No subtasks provided for task ${task.id}`);
      return;
    }

    // Limit number of subtasks
    const subtaskDescriptions = breakdown.subtasks.slice(0, this.config.maxSubtasksPerTask);

    console.log(`[TaskOrchestrator] Breaking down task ${task.id} into ${subtaskDescriptions.length} subtasks`);

    // Create all subtasks first (without recursion)
    for (let i = 0; i < subtaskDescriptions.length; i++) {
      const subtaskDesc = subtaskDescriptions[i];
      const subtaskId = TaskManager.generateTaskId(task.id, i);

      const subtask: Task = {
        id: subtaskId,
        parentId: task.id,
        description: subtaskDesc.description,
        complexity: subtaskDesc.estimatedComplexity,
        status: 'planned',
        level: task.level + 1,
        subtasks: [],
        dependencies: subtaskDesc.dependencies?.map(depIdx =>
          TaskManager.generateTaskId(task.id, depIdx)
        ),
      };

      task.subtasks.push(subtask);
      taskTree.allTasks.set(subtaskId, subtask);
    }

    // Notify progress IMMEDIATELY after creating subtasks (before recursion)
    // This allows UI to see the tree incrementally as each node is broken down
    this.notifyProgress({
      type: 'breakdown_completed',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
      task: task, // Current task with its newly created subtasks
      rootTask: this.rootTask, // Full hierarchy for UI
    });

    // NOW recursively break down each subtask
    for (const subtask of task.subtasks) {
      await this.breakdownTaskRecursively(subtask, taskTree, conversationContext, breakdownFn);
    }

  }

  /**
   * Execute all leaf tasks in calculated order
   */
  private async executeTasksInOrder(
    taskTree: TaskTree,
    conversationContext: string,
    executeFn: (req: TaskExecutionRequest) => Promise<TaskExecutionResponse>,
    breakdownFn: (req: TaskBreakdownRequest) => Promise<TaskBreakdownResponse>
  ): Promise<void> {
    console.log('[TaskOrchestrator] Starting task execution in order');

    for (const taskId of taskTree.executionOrder) {
      const task = taskTree.allTasks.get(taskId);
      if (!task) {
        console.error(`[TaskOrchestrator] Task ${taskId} not found in task map`);
        continue;
      }

      // Check if dependencies are completed
      if (!TaskManager.areDependenciesCompleted(task, taskTree.allTasks)) {
        console.log(`[TaskOrchestrator] Task ${taskId} dependencies not met, marking as blocked`);
        task.status = 'blocked';
        continue;
      }

      // Execute task
      await this.executeSingleTask(task, taskTree, conversationContext, executeFn, breakdownFn);
    }
  }

  /**
   * Execute a single task
   */
  private async executeSingleTask(
    task: Task,
    taskTree: TaskTree,
    conversationContext: string,
    executeFn: (req: TaskExecutionRequest) => Promise<TaskExecutionResponse>,
    breakdownFn: (req: TaskBreakdownRequest) => Promise<TaskBreakdownResponse>
  ): Promise<void> {
    console.log(`[TaskOrchestrator] Executing task ${task.id}: ${task.description}`);

    // Mark as in progress
    task.status = 'in_progress';
    task.executionStartTime = new Date();
    taskTree.currentTaskId = task.id;

    // Notify progress with tree update
    this.notifyProgress({
      type: 'task_started',
      taskId: task.id,
      taskDescription: task.description,
      progress: TaskManager.calculateProgress(taskTree),
      currentTask: task.description,
      task: task,
      rootTask: this.rootTask, // Send full tree so UI can show status change
    });

    // Collect context from completed sibling tasks
    const previousResults = this.collectSiblingResults(task, taskTree);

    // Execute task
    const executionRequest: TaskExecutionRequest = {
      task,
      conversationContext,
      previousResults,
      siblingContext: previousResults.join('\n'),
    };

    try {
      const response = await executeFn(executionRequest);

      if (response.status === 'completed') {
        task.status = 'completed';
        task.result = response.result;
        task.executionEndTime = new Date();
        taskTree.completedTasks++;

        console.log(`[TaskOrchestrator] Task ${task.id} completed successfully`);

        // Notify progress with tree update
        this.notifyProgress({
          type: 'task_completed',
          taskId: task.id,
          taskDescription: task.description,
          progress: TaskManager.calculateProgress(taskTree),
          result: response.result,
          task: task,
          rootTask: this.rootTask, // Send full tree so UI can show completed status
        });

        // Update parent's subtask results
        this.updateParentSubtaskResults(task, taskTree);
      } else {
        // Task failed
        task.status = 'failed';
        task.error = response.error || 'Unknown error';
        task.executionEndTime = new Date();
        taskTree.failedTasks++;

        console.error(`[TaskOrchestrator] Task ${task.id} failed:`, response.error);

        // Notify progress with tree update
        this.notifyProgress({
          type: 'task_failed',
          taskId: task.id,
          taskDescription: task.description,
          progress: TaskManager.calculateProgress(taskTree),
          task: task,
          rootTask: this.rootTask, // Send full tree so UI can show failed status
        });

        // If task needs refinement, try breaking it down
        if (response.needsRefinement && task.level < this.config.maxNestingLevel) {
          console.log(`[TaskOrchestrator] Task ${task.id} needs refinement, attempting breakdown`);
          task.status = 'planned';
          task.complexity = 'complex';
          await this.breakdownTaskRecursively(task, taskTree, conversationContext, breakdownFn);

          // Recalculate execution order
          taskTree.executionOrder = TaskManager.calculateExecutionOrder(taskTree.rootTask);

          // Execute subtasks
          await this.executeTasksInOrder(taskTree, conversationContext, executeFn, breakdownFn);
        }
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.executionEndTime = new Date();
      taskTree.failedTasks++;

      console.error(`[TaskOrchestrator] Exception during task ${task.id} execution:`, error);

      this.notifyProgress({
        type: 'task_failed',
        taskId: task.id,
        taskDescription: task.description,
        progress: TaskManager.calculateProgress(taskTree),
      });
    }

    taskTree.currentTaskId = null;
  }

  /**
   * Collect results from completed sibling tasks
   */
  private collectSiblingResults(task: Task, taskTree: TaskTree): string[] {
    if (!task.parentId) return [];

    const parent = taskTree.allTasks.get(task.parentId);
    if (!parent) return [];

    return parent.subtasks
      .filter(sibling => sibling.status === 'completed' && sibling.id !== task.id)
      .map(sibling => `${sibling.description}: ${sibling.result}`)
      .filter(Boolean) as string[];
  }

  /**
   * Update parent's subtask results after task completion
   */
  private updateParentSubtaskResults(task: Task, taskTree: TaskTree): void {
    if (!task.parentId) return;

    const parent = taskTree.allTasks.get(task.parentId);
    if (!parent) return;

    if (!parent.subtaskResults) {
      parent.subtaskResults = [];
    }

    parent.subtaskResults.push(task.result || '');

    // Check if all subtasks are completed
    const allCompleted = parent.subtasks.every(st => st.status === 'completed' || st.status === 'failed');

    if (allCompleted) {
      console.log(`[TaskOrchestrator] All subtasks of ${parent.id} completed, collecting results`);
      parent.result = TaskManager.collectResults(parent);
      parent.status = 'completed';
    }
  }

  /**
   * Generate final report after all tasks completed
   */
  private async generateFinalReport(
    taskTree: TaskTree,
    conversationContext: string,
    reportFn: (req: ReportGenerationRequest) => Promise<FinalReport>
  ): Promise<FinalReport> {
    console.log('[TaskOrchestrator] Generating final report');

    const reportRequest: ReportGenerationRequest = {
      rootTask: taskTree.rootTask,
      taskTree,
      conversationContext,
    };

    const report = await reportFn(reportRequest);

    return report;
  }

  /**
   * Notify progress to callback
   */
  private notifyProgress(update: Parameters<ProgressCallback>[0]): void {
    if (this.config.enableProgressCallbacks && this.progressCallback) {
      this.progressCallback(update);
    }
  }
}

/**
 * Helper function to format task tree for display
 */
export function formatTaskTreeForDisplay(task: Task, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  const statusIcon = {
    planned: '⏱',
    in_progress: '⏳',
    completed: '✓',
    failed: '✗',
    blocked: '🔒',
    skipped: '⏭',
  }[task.status];

  let output = `${prefix}${statusIcon} ${task.description}\n`;

  if (task.result && task.status === 'completed') {
    output += `${prefix}  → ${task.result}\n`;
  }

  if (task.error && task.status === 'failed') {
    output += `${prefix}  ✗ Ошибка: ${task.error}\n`;
  }

  for (const subtask of task.subtasks) {
    output += formatTaskTreeForDisplay(subtask, indent + 1);
  }

  return output;
}
