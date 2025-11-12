/**
 * Task Management Types for Hierarchical Task Execution
 *
 * This module defines types for breaking down complex tasks into subtasks,
 * executing them sequentially, and collecting results hierarchically.
 *
 * Version: 1.0
 * Date: 2025-10-22
 */

/**
 * Task status throughout its lifecycle
 *
 * v2.0 - Enhanced with granular failure states
 */
export type TaskStatus =
  | 'planned'           // Task is planned but not started
  | 'in_progress'       // Task is currently being executed
  | 'completed'         // Task completed successfully
  | 'failed'            // Generic failure (deprecated - use specific statuses)
  | 'needUserInput'     // Waiting for user to provide missing information
  | 'needsResearch'     // Requires web research via perplexityResearch
  | 'researchFailed'    // Web research attempted but failed
  | 'toolError'         // MCP tool execution error
  | 'blocked'           // Task is blocked by dependencies
  | 'skipped';          // Task skipped based on context (adaptive execution)

/**
 * Task complexity determines execution strategy
 */
export type TaskComplexity =
  | 'simple'       // Can be executed directly by realtime agent
  | 'moderate'     // Needs supervisor, but no breakdown
  | 'complex';     // Needs breakdown into subtasks

/**
 * Single task in the hierarchy
 */
export interface Task {
  id: string;                          // Unique task ID (e.g., "task-1", "task-1.2.3")
  parentId: string | null;             // Parent task ID (null for root task)
  description: string;                 // Russian description of what to do
  complexity: TaskComplexity;          // Determines execution strategy
  status: TaskStatus;                  // Current status
  level: number;                       // Nesting level (0 = root, 1 = subtask, etc.)

  // Execution details
  result?: string;                     // Result after completion (in Russian)
  error?: string;                      // Error message if failed
  executionStartTime?: Date;           // When execution started
  executionEndTime?: Date;             // When execution finished

  // Hierarchical structure
  subtasks: Task[];                    // Child tasks (if broken down)
  subtaskResults?: string[];           // Collected results from subtasks

  // Context for execution
  context?: Record<string, any>;       // Additional context needed for execution
  dependencies?: string[];             // IDs of tasks that must complete first
}

/**
 * Task tree represents entire hierarchy
 */
export interface TaskTree {
  rootTask: Task;                      // The original complex task
  allTasks: Map<string, Task>;         // Flat map of all tasks by ID
  executionOrder: string[];            // Ordered list of task IDs to execute
  currentTaskId: string | null;        // ID of currently executing task

  // Progress tracking
  totalTasks: number;                  // Total number of leaf tasks
  completedTasks: number;              // Number of completed leaf tasks
  failedTasks: number;                 // Number of failed tasks

  // Conversation context
  conversationHistory: string[];       // Full conversation for context
}

/**
 * Request to break down a task into subtasks
 */
export interface TaskBreakdownRequest {
  task: Task;                          // The task to break down
  conversationContext: string;         // Full conversation history
  previousResults?: string[];          // Results from completed sibling tasks
}

/**
 * Response from supervisor with task breakdown
 */
export interface TaskBreakdownResponse {
  shouldBreakdown: boolean;            // Whether task needs breakdown
  subtasks?: {
    description: string;               // Description in Russian (future tense)
    estimatedComplexity: TaskComplexity;
    dependencies?: number[];           // Indices of subtasks that must complete first
  }[];
  reasoning: string;                   // Why breakdown is/isn't needed
  directExecution?: {                  // If no breakdown, execute directly
    canExecuteDirectly: boolean;
    executor: 'realtime' | 'supervisor';
  };
}

/**
 * Request to execute a single task
 */
export interface TaskExecutionRequest {
  task: Task;                          // The task to execute
  conversationContext: string;         // Full conversation history
  previousResults?: string[];          // Results from completed tasks in same level
  siblingContext?: string;             // Context from sibling tasks
}

/**
 * Response after task execution
 *
 * v2.0 - Supports granular status codes
 */
export interface TaskExecutionResponse {
  status: 'completed' | 'failed' | 'needUserInput' | 'needsResearch' | 'researchFailed' | 'toolError';
  result?: string;                     // Result in Russian (past tense)
  error?: string;                      // Error message if failed
  userQuestion?: string;               // Question to ask user (when status = needUserInput)
  researchQuery?: string;              // Suggested research query (when status = needsResearch)
  workflowSteps?: string[];            // Steps taken during execution
  needsRefinement?: boolean;           // If result quality is insufficient
  metadata?: {                         // Additional metadata
    toolUsed?: string;                 // Which tool was used (mcp/perplexityResearch)
    attemptedActions?: string[];       // Actions attempted before failure
  };
}

/**
 * Report generation request
 */
export interface ReportGenerationRequest {
  rootTask: Task;                      // The original task
  taskTree: TaskTree;                  // Full task tree with results
  conversationContext: string;         // Original conversation
}

/**
 * Final report after all tasks completed
 */
export interface FinalReport {
  summary: string;                     // High-level summary in Russian
  detailedResults: string;             // Detailed results organized hierarchically
  tasksCompleted: number;              // Total leaf tasks completed
  tasksFailed: number;                 // Total tasks failed
  executionTime: number;               // Total execution time in ms
  hierarchicalBreakdown: {             // Structured breakdown for UI
    taskId: string;
    description: string;
    status: TaskStatus;
    result?: string;
    subtasks?: any[];                  // Recursive structure
  };
}

/**
 * Utility functions for task management
 */
export class TaskManager {
  /**
   * Generate unique task ID based on position in hierarchy
   */
  static generateTaskId(parentId: string | null, childIndex: number): string {
    if (!parentId) {
      return 'task-root';
    }
    return `${parentId}.${childIndex}`;
  }

  /**
   * Get task level from ID
   */
  static getTaskLevel(taskId: string): number {
    if (taskId === 'task-root') return 0;
    return taskId.split('.').length - 1;
  }

  /**
   * Check if task is a leaf (no subtasks)
   */
  static isLeafTask(task: Task): boolean {
    return task.subtasks.length === 0;
  }

  /**
   * Get all leaf tasks from tree
   */
  static getLeafTasks(task: Task): Task[] {
    if (this.isLeafTask(task)) {
      return [task];
    }
    return task.subtasks.flatMap(subtask => this.getLeafTasks(subtask));
  }

  /**
   * Calculate execution order (depth-first, respecting dependencies)
   */
  static calculateExecutionOrder(rootTask: Task): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (task: Task) => {
      if (visited.has(task.id)) return;

      // If task has subtasks, process them first
      if (task.subtasks.length > 0) {
        // Sort subtasks by dependencies
        const sortedSubtasks = this.topologicalSort(task.subtasks);
        sortedSubtasks.forEach(subtask => visit(subtask));
      } else {
        // Leaf task - add to execution order
        order.push(task.id);
      }

      visited.add(task.id);
    };

    visit(rootTask);
    return order;
  }

  /**
   * Topological sort for tasks with dependencies
   */
  static topologicalSort(tasks: Task[]): Task[] {
    // Simple implementation - can be enhanced with proper dependency resolution
    // For now, just return tasks in order, assuming dependencies are correctly set
    return [...tasks];
  }

  /**
   * Build flat map of all tasks
   */
  static buildTaskMap(rootTask: Task): Map<string, Task> {
    const map = new Map<string, Task>();

    const visit = (task: Task) => {
      map.set(task.id, task);
      task.subtasks.forEach(subtask => visit(subtask));
    };

    visit(rootTask);
    return map;
  }

  /**
   * Calculate progress percentage
   */
  static calculateProgress(taskTree: TaskTree): number {
    if (taskTree.totalTasks === 0) return 0;
    return Math.round((taskTree.completedTasks / taskTree.totalTasks) * 100);
  }

  /**
   * Collect results hierarchically
   */
  static collectResults(task: Task): string {
    if (this.isLeafTask(task)) {
      return task.result || '';
    }

    // Collect results from subtasks
    const subtaskResults = task.subtasks
      .filter(st => st.status === 'completed')
      .map((st, idx) => `${idx + 1}. ${st.description}: ${this.collectResults(st)}`)
      .join('\n');

    return subtaskResults;
  }

  /**
   * Check if all dependencies are completed
   */
  static areDependenciesCompleted(task: Task, taskMap: Map<string, Task>): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = taskMap.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }
}
