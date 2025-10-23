import { RealtimeItem, tool } from '@openai/agents/realtime';

/**
 * Types for supervisor agent decision-making
 * These types match the server-side Agent implementation
 */
export type SupervisorDecision = 'approve' | 'modify' | 'reject' | 'delegateBack';

export interface SupervisorResponse {
  decision: SupervisorDecision;
  suggestedChanges?: string;
  reasoning: string;
  nextResponse?: string;
  plannedSteps?: string[]; // OPTIONAL: For PLAN FIRST mode (future tense steps)
  workflowSteps?: string[]; // REQUIRED for EXECUTE IMMEDIATELY mode (past tense steps)
}

/**
 * NOTE: The following have been moved to /api/supervisor/agent.ts:
 * - supervisorAgentInstructions (now in Agent class)
 * - supervisorMcpTools (now in Agent class)
 * - fetchSupervisorResponse (replaced by SDK's run() function)
 * - handleSupervisorToolCalls (replaced by SDK's automatic tool handling)
 *
 * The new architecture uses Agent SDK which automatically handles:
 * - Tool call loops
 * - MCP tool execution
 * - Response parsing
 * - Error handling
 */

/**
 * Legacy heuristic function - DEPRECATED
 *
 * @deprecated This function is no longer needed. The RealtimeAgent now decides
 * when to delegate based on its instructions. The supervisor agent also has
 * built-in logic to delegateBack simple tasks, providing self-correction.
 *
 * This function is kept for backward compatibility but should not be used
 * in new code. Remove it once all references are updated.
 */
export function shouldDelegateToSupervisor(_context: {
  userMessage: string;
  conversationHistory: RealtimeItem[];
  availableTools: string[];
}): boolean {
  console.warn('[supervisorAgent] shouldDelegateToSupervisor is DEPRECATED - RealtimeAgent should decide delegation');

  // Return true to always allow delegation - let the supervisor decide via delegateBack
  // This ensures backward compatibility while the migration is in progress
  return true;
}

/**
 * Tool that delegates complex requests to the GPT-4o supervisor agent
 *
 * This tool is called by the primary severstalAssistant when it determines
 * a request is too complex for direct tool execution and requires multi-step
 * reasoning, conditional logic, or data synthesis.
 */
export const delegateToSupervisor = tool({
  name: 'delegateToSupervisor',
  description:
    'Delegates complex tasks to a highly intelligent GPT-4o supervisor agent that can handle multi-step operations, conditional logic, and ambiguous requests requiring contextual understanding. Use this for tasks that require more than one tool call or sophisticated reasoning.',
  parameters: {
    type: 'object',
    properties: {
      conversationContext: {
        type: 'string',
        description:
          'Brief summary of the conversation so far, including key user requirements and any information already gathered.',
      },
      proposedPlan: {
        type: 'string',
        description:
          'Your initial understanding of what needs to be done. The supervisor will evaluate and potentially improve this plan.',
      },
      userIntent: {
        type: 'string',
        description:
          'What the user is ultimately trying to accomplish (e.g., "schedule meeting", "organize emails", "find availability").',
      },
      complexity: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description:
          'Your assessment of task complexity: high (3+ steps or ambiguous), medium (2 steps or conditional), low (unclear but possibly simple).',
      },
    },
    required: ['conversationContext', 'proposedPlan', 'userIntent', 'complexity'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    console.log('[supervisorAgent] delegateToSupervisor tool execute called');
    console.log('[supervisorAgent] Input:', JSON.stringify(input, null, 2));

    const { conversationContext, proposedPlan, userIntent, complexity } = input as {
      conversationContext: string;
      proposedPlan: string;
      userIntent: string;
      complexity: 'high' | 'medium' | 'low';
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];

    if (addBreadcrumb) {
      addBreadcrumb('[Supervisor] Request sent', { userIntent, complexity });
    }

    try {
      // Call the new server-side Agent API endpoint
      const response = await fetch('/api/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationContext,
          proposedPlan,
          userIntent,
          complexity,
          history,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[supervisorAgent] API error:', errorData);
        return {
          error: errorData.error || 'Supervisor unavailable',
          fallbackResponse: 'Извините, не могу обработать этот запрос. Попробуйте попроще?',
        };
      }

      const supervisorDecision: SupervisorResponse = await response.json();
      console.log('[supervisorAgent] Supervisor decision received:', supervisorDecision.decision);

      if (addBreadcrumb) {
        addBreadcrumb('[Supervisor] Decision received', supervisorDecision);

        // ✅ QW-3: Add breadcrumbs for each workflow step (if provided)
        if (supervisorDecision.workflowSteps && supervisorDecision.workflowSteps.length > 0) {
          supervisorDecision.workflowSteps.forEach((step: string, index: number) => {
            addBreadcrumb(`[Supervisor] Шаг ${index + 1}/${supervisorDecision.workflowSteps!.length}`, {
              step,
              completed: true,
            });
          });
          console.log(`[supervisorAgent] Added ${supervisorDecision.workflowSteps.length} workflow step breadcrumbs`);
        }

        // Add breadcrumbs for planned steps (if provided)
        if (supervisorDecision.plannedSteps && supervisorDecision.plannedSteps.length > 0) {
          addBreadcrumb('[Supervisor] План выполнения составлен', {
            totalSteps: supervisorDecision.plannedSteps.length,
            steps: supervisorDecision.plannedSteps,
          });
          console.log(`[supervisorAgent] Added plan with ${supervisorDecision.plannedSteps.length} steps`);
        }
      }

      return supervisorDecision;
    } catch (error) {
      console.error('[supervisorAgent] Network error:', error);
      return {
        error: 'Network error',
        fallbackResponse: 'Извините, не могу обработать этот запрос. Попробуйте попроще?',
      };
    }
  },
});
