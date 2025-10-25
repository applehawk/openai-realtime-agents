/**
 * Task Context Store - Global storage for active task contexts
 * 
 * This store maintains real-time information about running tasks from IntelligentSupervisor,
 * making it accessible to RealtimeAgent (routerAgent) for context awareness.
 * 
 * Version: 1.0
 * Date: 2025-10-25
 */

export interface TaskContext {
  sessionId: string;
  hierarchicalBreakdown: {
    taskId: string;
    description: string;
    status: 'planned' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    complexity?: 'simple' | 'medium' | 'complex';
    executionStrategy?: 'direct' | 'flat' | 'hierarchical';
    result?: string;
    subtasks?: any[];
  };
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  lastUpdate: number;
  strategy: 'direct' | 'flat' | 'hierarchical';
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * Singleton store for task contexts
 */
class TaskContextStore {
  private static instance: TaskContextStore;
  private contexts: Map<string, TaskContext> = new Map();
  private readonly TTL = 30 * 60 * 1000; // 30 minutes TTL

  private constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  public static getInstance(): TaskContextStore {
    if (!TaskContextStore.instance) {
      TaskContextStore.instance = new TaskContextStore();
    }
    return TaskContextStore.instance;
  }

  /**
   * Set or update task context
   */
  public setContext(sessionId: string, context: Partial<TaskContext>): void {
    const existing = this.contexts.get(sessionId);
    
    const updated: TaskContext = {
      sessionId,
      hierarchicalBreakdown: context.hierarchicalBreakdown || existing?.hierarchicalBreakdown || {
        taskId: 'task-root',
        description: 'Unknown task',
        status: 'planned',
        subtasks: [],
      },
      progress: context.progress || existing?.progress || { current: 0, total: 0, percentage: 0 },
      lastUpdate: Date.now(),
      strategy: context.strategy || existing?.strategy || 'direct',
      complexity: context.complexity || existing?.complexity || 'simple',
    };

    this.contexts.set(sessionId, updated);
    console.log(`[TaskContextStore] Updated context for session ${sessionId}:`, {
      taskId: updated.hierarchicalBreakdown.taskId,
      subtasksCount: updated.hierarchicalBreakdown.subtasks?.length || 0,
      progress: updated.progress.percentage,
    });
  }

  /**
   * Get task context by sessionId
   */
  public getContext(sessionId: string): TaskContext | null {
    const context = this.contexts.get(sessionId);
    
    if (!context) {
      console.log(`[TaskContextStore] No context found for session ${sessionId}`);
      return null;
    }

    // Check if context is expired
    if (Date.now() - context.lastUpdate > this.TTL) {
      console.log(`[TaskContextStore] Context expired for session ${sessionId}`);
      this.contexts.delete(sessionId);
      return null;
    }

    return context;
  }

  /**
   * Get all active contexts
   */
  public getAllContexts(): TaskContext[] {
    return Array.from(this.contexts.values()).filter(
      (ctx) => Date.now() - ctx.lastUpdate <= this.TTL
    );
  }

  /**
   * Remove context
   */
  public removeContext(sessionId: string): void {
    this.contexts.delete(sessionId);
    console.log(`[TaskContextStore] Removed context for session ${sessionId}`);
  }

  /**
   * Cleanup expired contexts
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, context] of this.contexts.entries()) {
      if (now - context.lastUpdate > this.TTL) {
        this.contexts.delete(sessionId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[TaskContextStore] Cleaned up ${removed} expired contexts`);
    }
  }

  /**
   * Get store stats
   */
  public getStats(): { activeContexts: number; totalSize: number } {
    return {
      activeContexts: this.contexts.size,
      totalSize: this.getAllContexts().length,
    };
  }
}

// Export singleton instance
export const taskContextStore = TaskContextStore.getInstance();

