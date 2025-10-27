/**
 * Get Task Context Tool
 * 
 * Allows routerAgent to retrieve current task execution context from IntelligentSupervisor.
 * Context is accessed through extraContext passed to RealtimeSession.
 * 
 * Version: 2.0
 * Date: 2025-10-25
 */

import { tool } from '@openai/agents';

export const getTaskContext = tool({
  name: 'getTaskContext',
  description: `Get current task execution context from IntelligentSupervisor.

Use this tool to understand what complex tasks are currently being executed.
This provides visibility into:
- Task structure (root task and subtasks)  
- Current execution status
- Progress information
- Task complexity and strategy

When to use:
- User asks "что ты сейчас делаешь?" or "какой прогресс?"
- During long-running tasks to provide status updates
- To check if a task is still running

Example usage:
User: "Что ты сейчас делаешь?"
You: [call getTaskContext with sessionId from active task]
You: "Работаю над встречей с Петром. Уже проверил календарь, сейчас создаю событие."`,

  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID of the task to check (you receive this when delegating to supervisor)',
      },
    },
    required: ['sessionId'],
    additionalProperties: false,
  },

  execute: async (input, details) => {
    // Type guard to ensure input has the expected structure
    if (!input || typeof input !== 'object' || !('sessionId' in input) || typeof input.sessionId !== 'string') {
      return {
        success: false,
        error: 'Invalid input: sessionId is required and must be a string',
        sessionId: 'unknown',
      };
    }

    console.log('[getTaskContextTool] Checking task context for session:', input.sessionId);

    // Access taskContextStore через extraContext
    const getTaskContextFn = (details?.context as any)?.getTaskContext;
    
    if (!getTaskContextFn || typeof getTaskContextFn !== 'function') {
      console.error('[getTaskContextTool] getTaskContext function not available in context');
      return {
        success: false,
        error: 'Task context access not configured. This is a system configuration issue.',
        sessionId: input.sessionId,
      };
    }

    try {
      const context = await getTaskContextFn(input.sessionId);
      
      if (!context) {
        return {
          success: false,
          error: 'Task context not found. The task may have completed or expired.',
          sessionId: input.sessionId,
        };
      }

      console.log('[getTaskContextTool] Task context retrieved:', {
        sessionId: input.sessionId,
        taskId: context.hierarchicalBreakdown?.taskId,
        status: context.hierarchicalBreakdown?.status,
        subtasksCount: context.hierarchicalBreakdown?.subtasks?.length || 0,
        progress: context.progress?.percentage,
      });

      // Prepare user-friendly response
      return {
        success: true,
        sessionId: context.sessionId,
        task: {
          description: context.hierarchicalBreakdown.description,
          status: context.hierarchicalBreakdown.status,
          complexity: context.complexity,
          strategy: context.strategy,
          result: context.hierarchicalBreakdown.result,
          subtasks: (context.hierarchicalBreakdown.subtasks || []).map((st: any, idx: number) => ({
            number: idx + 1,
            description: st.description,
            status: st.status,
            result: st.result,
          })),
          totalSubtasks: context.hierarchicalBreakdown.subtasks?.length || 0,
        },
        progress: {
          percentage: context.progress.percentage,
          message: `${context.progress.percentage}% complete`,
        },
      };
    } catch (error) {
      console.error('[getTaskContextTool] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        sessionId: input.sessionId,
      };
    }
  },
});

