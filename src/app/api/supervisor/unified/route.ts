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
    const { taskDescription, conversationContext, executionMode, maxComplexity, history } = body;

    console.log('[API /api/supervisor/unified] Request received:', {
      taskDescription: taskDescription?.substring(0, 100) + '...',
      executionMode: executionMode || 'auto',
      maxComplexity: maxComplexity || 'hierarchical',
      historyLength: history?.length || 0,
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

    // Create IntelligentSupervisor with config
    const supervisor = new IntelligentSupervisor({
      enableProgressCallbacks: true,
      maxComplexity: maxComplexity || 'hierarchical',
      maxNestingLevel: 5,
      maxSubtasksPerTask: 10,
    });

    // Build unified request
    const unifiedRequest: UnifiedRequest = {
      taskDescription,
      conversationContext,
      executionMode: executionMode || 'auto',
      history,
    };

    console.log('[API /api/supervisor/unified] Executing with IntelligentSupervisor...');

    // Execute task with adaptive complexity
    const result = await supervisor.execute(unifiedRequest);

    console.log('[API /api/supervisor/unified] Execution complete:', {
      strategy: result.strategy,
      complexity: result.complexity,
      executionTime: result.executionTime,
      workflowStepsCount: result.workflowSteps.length,
    });

    return NextResponse.json(result);
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
