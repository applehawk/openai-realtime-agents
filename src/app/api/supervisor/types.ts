/**
 * Types for supervisor agent decision-making
 */

export type SupervisorDecision = 'approve' | 'modify' | 'reject' | 'delegateBack';

export interface SupervisorRequest {
  conversationContext: string;
  proposedPlan: string;
  metadata: {
    userIntent: string;
    complexity: 'high' | 'medium' | 'low';
    requiresMultipleTools: boolean;
  };
}

export interface SupervisorResponse {
  decision: SupervisorDecision;
  suggestedChanges?: string;
  reasoning: string;
  nextResponse?: string;
  plannedSteps?: string[]; // Optional: PLAN - steps to be executed (before execution, for user confirmation)
  workflowSteps?: string[]; // REQUIRED for 'approve' EXECUTE IMMEDIATELY - steps actually taken (after execution)
}

