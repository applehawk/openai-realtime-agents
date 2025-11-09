/**
 * HITL (Human-in-the-Loop) Store
 *
 * Manages pending HITL approvals and their resolutions.
 * Used by IntelligentSupervisor to pause execution and wait for user input.
 */

export interface HITLPendingApproval {
  sessionId: string;
  itemId: string;
  type: "PLAN_APPROVAL" | "DECOMPOSITION_DECISION";
  question: string;
  content: string;
  metadata?: any;
  createdAt: number;
  resolvedAt?: number;
  resolution?: {
    decision: "approved" | "rejected" | "modified";
    modifiedContent?: string;
    feedback?: string;
  };
}

class HITLStore {
  private pendingApprovals: Map<string, HITLPendingApproval> = new Map();
  private resolvers: Map<string, (value: HITLPendingApproval) => void> = new Map();

  /**
   * Create a new pending approval and wait for resolution
   * Returns: { approval, promise } where approval contains the itemId
   */
  createApproval(
    sessionId: string,
    type: "PLAN_APPROVAL" | "DECOMPOSITION_DECISION",
    question: string,
    content: string,
    metadata?: any
  ): { approval: HITLPendingApproval; promise: Promise<HITLPendingApproval> } {
    const itemId = `hitl-${sessionId}-${Date.now()}`;

    const approval: HITLPendingApproval = {
      sessionId,
      itemId,
      type,
      question,
      content,
      metadata,
      createdAt: Date.now(),
    };

    this.pendingApprovals.set(itemId, approval);

    console.log('[HITLStore] Created pending approval:', { sessionId, itemId, type });

    // Create promise that will be resolved when user approves/rejects
    const promise = new Promise<HITLPendingApproval>((resolve) => {
      this.resolvers.set(itemId, resolve);

      // Auto-timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingApprovals.has(itemId)) {
          console.warn('[HITLStore] Auto-rejecting approval due to timeout:', itemId);
          this.resolveApproval(itemId, "rejected", undefined, "Timeout: No user response");
        }
      }, 5 * 60 * 1000);
    });

    return { approval, promise };
  }

  /**
   * Resolve a pending approval (called by API endpoint)
   */
  resolveApproval(
    itemId: string,
    decision: "approved" | "rejected" | "modified",
    modifiedContent?: string,
    feedback?: string
  ): boolean {
    const approval = this.pendingApprovals.get(itemId);
    if (!approval) {
      console.warn('[HITLStore] Approval not found:', itemId);
      return false;
    }

    approval.resolvedAt = Date.now();
    approval.resolution = {
      decision,
      modifiedContent,
      feedback,
    };

    console.log('[HITLStore] Resolved approval:', {
      itemId,
      decision,
      hasModifiedContent: !!modifiedContent,
      hasFeedback: !!feedback,
    });

    // Resolve the promise
    const resolver = this.resolvers.get(itemId);
    if (resolver) {
      resolver(approval);
      this.resolvers.delete(itemId);
    }

    // Keep approval for history (cleanup after 30 minutes)
    setTimeout(() => {
      this.pendingApprovals.delete(itemId);
    }, 30 * 60 * 1000);

    return true;
  }

  /**
   * Get pending approval by itemId
   */
  getPendingApproval(itemId: string): HITLPendingApproval | undefined {
    return this.pendingApprovals.get(itemId);
  }

  /**
   * Get all pending approvals for a session
   */
  getPendingApprovalsForSession(sessionId: string): HITLPendingApproval[] {
    return Array.from(this.pendingApprovals.values())
      .filter(a => a.sessionId === sessionId && !a.resolvedAt);
  }

  /**
   * Clear all pending approvals for a session
   */
  clearSession(sessionId: string): void {
    const approvals = this.getPendingApprovalsForSession(sessionId);
    approvals.forEach(a => {
      this.pendingApprovals.delete(a.itemId);
      this.resolvers.delete(a.itemId);
    });
    console.log('[HITLStore] Cleared session:', sessionId);
  }
}

export const hitlStore = new HITLStore();
