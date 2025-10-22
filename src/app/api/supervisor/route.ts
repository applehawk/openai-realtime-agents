import { NextRequest, NextResponse } from 'next/server';
import { run } from '@openai/agents';
import { supervisorAgent, SupervisorRequest, SupervisorResponse } from './agent';

/**
 * API endpoint for delegating complex tasks to the GPT-4o supervisor agent
 *
 * POST /api/supervisor
 * Body: {
 *   conversationContext: string,
 *   proposedPlan: string,
 *   userIntent: string,
 *   complexity: 'high' | 'medium' | 'low',
 *   history: RealtimeItem[]
 * }
 *
 * Returns: SupervisorResponse {
 *   decision: 'approve' | 'modify' | 'reject' | 'delegateBack',
 *   reasoning: string,
 *   suggestedChanges?: string,
 *   nextResponse?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationContext, proposedPlan, userIntent, complexity, history } = body;

    console.log('[supervisor API] Request received:', {
      userIntent,
      complexity,
      historyLength: history?.length || 0,
    });

    // Validate required parameters
    if (!conversationContext || !proposedPlan || !userIntent || !complexity) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          required: ['conversationContext', 'proposedPlan', 'userIntent', 'complexity'],
        },
        { status: 400 }
      );
    }

    // Build the supervisor request
    const supervisorRequest: SupervisorRequest = {
      conversationContext,
      proposedPlan,
      metadata: {
        userIntent,
        complexity,
        requiresMultipleTools: complexity !== 'low',
      },
    };

    // Prepare input for the agent
    const input = `==== Conversation History ====
${JSON.stringify(history?.filter((item: any) => item.type === 'message') || [], null, 2)}

==== Supervisor Request ====
${JSON.stringify(supervisorRequest, null, 2)}

Please analyze this request and provide a JSON response with your decision (approve/modify/reject/delegateBack), reasoning, and any suggested changes or nextResponse text in Russian.`;

    console.log('[supervisor API] Running supervisor agent...');

    // Run the supervisor agent - SDK handles all tool calls automatically!
    const result = await run(supervisorAgent, input);

    console.log('[supervisor API] Agent completed:', {
      outputType: typeof result.finalOutput,
      outputLength: JSON.stringify(result.finalOutput).length,
    });

    // Parse the supervisor's JSON response
    let supervisorResponse: SupervisorResponse;

    if (typeof result.finalOutput === 'string') {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = result.finalOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[supervisor API] No JSON found in response:', result.finalOutput);
        return NextResponse.json(
          {
            error: 'Invalid supervisor response format',
            details: 'Expected JSON object',
          },
          { status: 500 }
        );
      }

      try {
        supervisorResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[supervisor API] JSON parse error:', parseError);
        return NextResponse.json(
          {
            error: 'Failed to parse supervisor response',
            details: (parseError as Error).message,
          },
          { status: 500 }
        );
      }
    } else if (result.finalOutput && typeof result.finalOutput === 'object') {
      // Already an object
      supervisorResponse = result.finalOutput as unknown as SupervisorResponse;
    } else {
      console.error('[supervisor API] Unexpected finalOutput type:', typeof result.finalOutput);
      return NextResponse.json(
        {
          error: 'Invalid supervisor response format',
          details: 'Unexpected output type',
        },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!supervisorResponse.decision || !supervisorResponse.reasoning) {
      console.error('[supervisor API] Invalid response structure:', supervisorResponse);
      return NextResponse.json(
        {
          error: 'Invalid supervisor response',
          details: 'Missing required fields: decision, reasoning',
        },
        { status: 500 }
      );
    }

    console.log('[supervisor API] Supervisor decision:', supervisorResponse.decision);

    return NextResponse.json(supervisorResponse);
  } catch (error) {
    console.error('[supervisor API] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
