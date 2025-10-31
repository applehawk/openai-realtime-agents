/**
 * Tool for delegating complex tasks to unified Intelligent Supervisor
 *
 * This tool provides adaptive task delegation with automatic complexity assessment.
 * It replaces the manual decision-making between delegateToSupervisor (Path 4)
 * and executeComplexTask (Path 5).
 *
 * Features:
 * - Automatic complexity assessment (simple/medium/complex)
 * - Adaptive strategy selection (direct/flat/hierarchical)
 * - Built-in progress tracking
 * - Support for PLAN FIRST and EXECUTE IMMEDIATELY modes
 * - Always returns workflowSteps for transparency
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { tool, RealtimeItem } from '@openai/agents/realtime';

/**
 * Tool that delegates tasks to unified Intelligent Supervisor
 */
export const delegateToIntelligentSupervisor = tool({
  name: 'delegateToIntelligentSupervisor',
  description: `Delegates multi-step or conditional tasks to an intelligent supervisor agent that automatically assesses complexity and executes the task.

USE THIS TOOL WHEN:
- Task requires 2+ sequential steps with conditional logic
- Task needs data coordination across multiple sources
- Uncertain whether task complexity requires supervisor assistance
- Need automatic complexity assessment and strategy selection

DO NOT USE THIS TOOL WHEN:
- Single-step action with explicit parameters (use direct MCP tools)
- Simple RAG query only (use lightrag_query)
- Basic read/write without logic (use corresponding MCP tool)

OUTPUTS:
Returns a JSON object with:
- success (boolean): Whether task completed successfully
- delegateBack (boolean): If true, task is simple enough for primary agent to handle directly. Follow the guidance provided.
- guidance (string): Instructions for primary agent when task is delegated back
- nextResponse (string): Supervisor's response when task is executed
- complexity (string): Assessed complexity level (tooSimple/simple/medium/complex)
- strategy (string): Execution strategy used (direct/flat/hierarchical)
- workflowSteps (array): Completed workflow steps for transparency
- executionTime (number): Execution duration in milliseconds

EDGE CASES:
- If delegateBack is true, primary agent must execute the task following guidance
- If API error occurs, returns success: false with error details and fallback response
- Tasks with 2-7 sequential steps but no complex logic will be marked tooSimple and delegated back

EXAMPLES:
Task: "Read email from Anna and schedule meeting"
Result: delegateBack=true (2 simple steps, no complex logic)

Task: "Find free time slot and create meeting with Peter"
Result: delegateBack=false, complexity=medium (requires time analysis)

Task: "If Peter is available, create meeting; otherwise send postponement email"
Result: delegateBack=false, complexity=medium (conditional logic)

Task: "Find all participants and send invitations to each"
Result: delegateBack=false, complexity=complex (batch operation)`,
  parameters: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description:
          'Complete task description in Russian. Include all requirements, context, constraints, and time frames. Must be detailed and specific (2-5 sentences minimum). Example: "Найди письмо от Анны Ивановой за последнюю неделю, прочитай его содержание, и если в нём упоминается встреча, создай событие в календаре на указанную дату с приглашением Анны."',
      },
      conversationContext: {
        type: 'string',
        description:
          'Brief summary of the conversation with user. Include key points already discussed and information already known. 2-3 sentences. Example: "Пользователь упомянул, что ожидает важное письмо от Анны. Ранее обсуждалась необходимость организации встречи на этой неделе."',
      },
      executionMode: {
        type: 'string',
        enum: ['auto', 'plan', 'execute'],
        description:
          "Execution mode: 'auto' (supervisor decides whether to show plan first or execute immediately), 'plan' (return plan WITHOUT execution for user confirmation), 'execute' (execute immediately without showing plan). Defaults to 'auto'.",
      },
    },
    required: ['taskDescription', 'conversationContext'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    console.log('[intelligentSupervisorTool] Tool execute called');
    console.log('[intelligentSupervisorTool] Input:', JSON.stringify(input, null, 2));

    const { taskDescription, conversationContext, executionMode } = input as {
      taskDescription: string;
      conversationContext: string;
      executionMode?: 'auto' | 'plan' | 'execute';
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const addTaskProgressMessage = (details?.context as any)?.addTaskProgressMessage as
      | ((sessionId: string, taskDescription: string) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];

    try {
      console.log('[intelligentSupervisorTool] Calling /api/supervisor/unified...');

      // Generate sessionId for progress tracking
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create TASK_PROGRESS message in transcript
      if (addTaskProgressMessage) {
        console.log('[intelligentSupervisorTool] Creating TASK_PROGRESS message with sessionId:', sessionId);
        addTaskProgressMessage(sessionId, taskDescription);
      }

      // Also add breadcrumb for debugging
      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Запрос отправлен', {
          sessionId,
          taskDescription: taskDescription.substring(0, 100) + '...',
          executionMode: executionMode || 'auto',
        });
      }

      // Store sessionId in tool result so agent can use getTaskContext later
      console.log('[intelligentSupervisorTool] Returning sessionId for context access:', sessionId);

      // Call the unified intelligent supervisor endpoint
      const response = await fetch('/api/supervisor/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription,
          conversationContext,
          executionMode: executionMode || 'auto',
          maxComplexity: 'hierarchical', // Allow full complexity range
          history,
          sessionId, // Pass sessionId for SSE tracking
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[intelligentSupervisorTool] API error:', response.status, errorText);

        if (addBreadcrumb) {
          addBreadcrumb('[Intelligent Supervisor] Ошибка выполнения', {
            status: response.status,
            error: errorText,
          });
        }

        return {
          success: false,
          error: `Ошибка выполнения задачи: ${response.statusText}`,
          fallbackResponse:
            'К сожалению, не удалось выполнить задачу. Попробуйте упростить запрос или обратитесь к другим инструментам.',
        };
      }

      const result = await response.json();

      console.log('[intelligentSupervisorTool] API response received:', {
        strategy: result.strategy,
        complexity: result.complexity,
        executionTime: result.executionTime,
        workflowStepsCount: result.workflowSteps?.length || 0,
        delegateBack: result.delegateBack || false,
      });

      // Handle delegateBack case (v3.2: now based on complexity === 'tooSimple')
      if (result.delegateBack || result.complexity === 'tooSimple') {
        console.log('[intelligentSupervisorTool] ✅ Task is tooSimple - delegated back to primary agent');
        console.log('[intelligentSupervisorTool] Guidance:', result.delegationGuidance);
        
        if (addBreadcrumb) {
          addBreadcrumb('[Intelligent Supervisor] Задача слишком проста - делегирована обратно', {
            guidance: result.delegationGuidance,
            complexity: 'tooSimple',
            executionTime: result.executionTime,
          });
        }

        return {
          success: true,
          delegateBack: true,
          guidance: result.delegationGuidance,
          nextResponse: result.nextResponse,
          complexity: result.complexity,
          executionTime: result.executionTime,
          message: '✅ Задача проста (tooSimple) и может быть выполнена напрямую. Следуй инструкциям в guidance.',
        };
      }

      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Выполнение завершено', {
          strategy: result.strategy,
          complexity: result.complexity,
          executionTime: result.executionTime,
        });

        // Add breadcrumbs for each workflow step (if provided)
        if (result.workflowSteps && result.workflowSteps.length > 0) {
          result.workflowSteps.forEach((step: string, index: number) => {
            addBreadcrumb(`[Intelligent Supervisor] Шаг ${index + 1}/${result.workflowSteps.length}`, {
              step,
              completed: true,
            });
          });
          console.log(
            `[intelligentSupervisorTool] Added ${result.workflowSteps.length} workflow step breadcrumbs`
          );
        }

        // Add breadcrumbs for planned steps (if provided)
        if (result.plannedSteps && result.plannedSteps.length > 0) {
          addBreadcrumb('[Intelligent Supervisor] План выполнения составлен', {
            totalSteps: result.plannedSteps.length,
            steps: result.plannedSteps,
          });
          console.log(
            `[intelligentSupervisorTool] Added plan with ${result.plannedSteps.length} steps`
          );
        }
      }

      console.log('[intelligentSupervisorTool] Returning result');

      return {
        success: true,
        sessionId, // ← IMPORTANT: Agent can use this with getTaskContext tool
        strategy: result.strategy,
        complexity: result.complexity,
        nextResponse: result.nextResponse,
        workflowSteps: result.workflowSteps || [],
        plannedSteps: result.plannedSteps,
        hierarchicalBreakdown: result.hierarchicalBreakdown,
        progress: result.progress,
        executionTime: result.executionTime,
      };
    } catch (error) {
      console.error('[intelligentSupervisorTool] Exception:', error);

      if (addBreadcrumb) {
        addBreadcrumb('[Intelligent Supervisor] Исключение', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackResponse:
          'Произошла ошибка при выполнении задачи. Попробуйте упростить запрос или использовать другие инструменты.',
      };
    }
  },
});
