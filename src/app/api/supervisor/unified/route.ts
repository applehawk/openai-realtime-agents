/**
 * API endpoint for unified intelligent task delegation
 *
 * POST /api/supervisor/unified
 * Body: {
 *   taskDescription: string,
 *   conversationContext: string,
 *   executionMode?: 'auto' | 'plan' | 'execute',
 *   maxComplexity?: 'flat' | 'hierarchical',
 *   history?: any[]
 * }
 *
 * Returns: UnifiedResponse {
 *   strategy: 'direct' | 'flat' | 'hierarchical',
 *   complexity: 'simple' | 'medium' | 'complex',
 *   nextResponse: string,
 *   workflowSteps: string[],
 *   hierarchicalBreakdown?: any,
 *   progress: { current: number, total: number },
 *   executionTime: number,
 *   plannedSteps?: string[]
 * }
 *
 * Version: 1.0
 * Date: 2025-10-23
 */

import { NextRequest, NextResponse } from 'next/server';
import { IntelligentSupervisor, UnifiedRequest } from './intelligentSupervisor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskDescription, conversationContext, executionMode, maxComplexity, history, sessionId: clientSessionId } = body;

    console.log('[API /api/supervisor/unified] Request received:', {
      taskDescription: taskDescription?.substring(0, 100) + '...',
      executionMode: executionMode || 'auto',
      maxComplexity: maxComplexity || 'hierarchical',
      historyLength: history?.length || 0,
      sessionId: clientSessionId || 'auto-generated',
    });

    // Validate required parameters
    if (!taskDescription || !conversationContext) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          required: ['taskDescription', 'conversationContext'],
        },
        { status: 400 }
      );
    }

    // Validate executionMode
    if (executionMode && !['auto', 'plan', 'execute'].includes(executionMode)) {
      return NextResponse.json(
        {
          error: 'Invalid executionMode',
          allowed: ['auto', 'plan', 'execute'],
        },
        { status: 400 }
      );
    }

    // Validate maxComplexity
    if (maxComplexity && !['flat', 'hierarchical'].includes(maxComplexity)) {
      return NextResponse.json(
        {
          error: 'Invalid maxComplexity',
          allowed: ['flat', 'hierarchical'],
        },
        { status: 400 }
      );
    }

    // Generate sessionId for this execution
    const sessionId = clientSessionId || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log('[API /api/supervisor/unified] Starting ASYNC execution with sessionId:', sessionId);

    // Return sessionId immediately - execution will happen in background
    // Client should connect to SSE stream to receive progress updates and final result
    const response = NextResponse.json({
      success: true,
      sessionId,
      message: 'Task execution started. Connect to /api/supervisor/unified/stream to receive updates.',
    });

    // Start async execution (don't await - fire and forget)
    executeTaskAsync(
      sessionId,
      taskDescription,
      conversationContext,
      executionMode || 'auto',
      maxComplexity || 'hierarchical',
      history
    ).catch((error) => {
      console.error('[API /api/supervisor/unified] Async execution error:', error);
    });

    return response;
  } catch (error) {
    console.error('[API /api/supervisor/unified] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Execute task asynchronously and emit results via SSE
 */
async function executeTaskAsync(
  sessionId: string,
  taskDescription: string,
  conversationContext: string,
  executionMode: 'auto' | 'plan' | 'execute',
  maxComplexity: 'flat' | 'hierarchical',
  history: any[]
): Promise<void> {
  console.log('[executeTaskAsync] Starting for session:', sessionId);

  try {
    // Create IntelligentSupervisor with config
    const supervisor = new IntelligentSupervisor({
      enableProgressCallbacks: true,
      maxComplexity,
      maxNestingLevel: 3,
      maxSubtasksPerTask: 12,
      sessionId,
    });

    // Build unified request
    const unifiedRequest: UnifiedRequest = {
      taskDescription,
      conversationContext,
      executionMode,
      history,
    };

    // Execute task with adaptive complexity
    const result = await supervisor.execute(unifiedRequest);

    console.log('[executeTaskAsync] Execution complete:', {
      sessionId,
      strategy: result.strategy,
      complexity: result.complexity,
      executionTime: result.executionTime,
      workflowStepsCount: result.workflowSteps.length,
    });

    // Emit final result via progress emitter (will be sent through SSE)
    // The 'completed' event is already emitted by supervisor.execute()
    // Just log confirmation here
    console.log('[executeTaskAsync] Final result emitted via SSE for session:', sessionId);
  } catch (error) {
    console.error('[executeTaskAsync] Error:', error);

    // Emit error via progress emitter
    const { progressEmitter } = await import('./progressEmitter');
    progressEmitter.emitProgress({
      sessionId,
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during task execution',
      progress: 0,
      timestamp: Date.now(),
      details: { error: error instanceof Error ? error.stack : String(error) },
    });
  }
}
