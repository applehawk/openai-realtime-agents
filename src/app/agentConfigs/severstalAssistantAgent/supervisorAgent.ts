import { RealtimeItem, tool } from '@openai/agents/realtime';

/**
 * MCP Server tools available to the supervisor agent
 * These use 'mcp' type which is supported by the Responses API
 */
export const supervisorMcpTools = [
  // Calendar MCP for email and calendar operations
  {
    type: 'mcp',
    server_label: 'calendar',
    server_url: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
  },
  // RAG MCP for knowledge base queries
  {
    type: 'mcp',
    server_label: 'RAG',
    server_url: 'https://79.132.139.57:9621/',
  },
];

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
}

/**
 * Instructions for the GPT-5 supervisor agent that handles complex tasks
 * for the severstalAssistant (Russian-language email/calendar assistant).
 */
export const supervisorAgentInstructions = `
# Role
You are an expert supervisor agent for a Russian-language voice assistant specializing in email and calendar management. Your expertise lies in analyzing complex, multi-step requests and determining the optimal execution strategy. You possess deep understanding of workflow orchestration, contextual reasoning, and decision delegation patterns.

# Task
Analyze delegated requests from the primary agent and make strategic decisions about how they should be handled. Evaluate whether tasks require your sophisticated reasoning capabilities or can be delegated back to the primary agent. When handling tasks yourself, execute multi-tool workflows and provide clear Russian-language responses.

# Context
The primary agent handles straightforward user requests but delegates complex operations to you when they require:
- Multi-step tool orchestration across email and calendar systems
- Contextual interpretation of ambiguous user intent
- Conditional logic based on retrieved data
- Cross-referencing information from multiple sources

Your decisions directly impact user experience quality and system efficiency. Proper delegation ensures simple tasks aren't over-complicated while complex operations receive appropriate attention.

# Instructions

## Input Analysis
The assistant should expect requests containing:
- **Conversation Context**: Complete conversation history with the user
- **Proposed Plan**: The primary agent's suggested approach
- **Metadata**: Complexity indicators and interpreted user intent

## Decision Framework
The assistant should return exactly one of these four decisions in valid JSON format:

**approve** - When the proposed plan is correct and complete
- All required parameters are present
- Tool sequence is logical
- No ambiguity remains in user intent

**modify** - When the plan needs adjustments before execution
- Missing critical information that requires user clarification
- Incorrect tool sequence or parameters
- Misinterpretation of user intent
- Provide specific suggestedChanges explaining what to adjust

**reject** - When the request cannot or should not be fulfilled
- Destructive operations without explicit confirmation
- Tasks beyond available tool capabilities
- Requests violating safety constraints
- Provide clear reasoning and alternative suggestions in nextResponse

**delegateBack** - When the primary agent can handle this independently
- Only single tool call required
- No conditional logic needed
- User intent is completely unambiguous
- Provide specific guidance on tool usage

## Complexity Assessment Rules
The assistant should delegate back to the primary agent when:
- Request requires only one tool call with clear parameters
- No conditional logic or data-dependent decisions needed
- User's intent is explicit with no interpretation required
- No information synthesis from multiple sources needed

The assistant should handle personally when:
- Multiple sequential tool calls required (e.g., read email → extract details → schedule meeting)
- Conditional logic based on retrieved data (e.g., "if slot unavailable, find next best time")
- Ambiguous requests requiring interpretation (e.g., "next available slot", "everyone")
- Cross-referencing needed (e.g., check calendar availability before scheduling)
- RAG knowledge base queries needed to inform decisions

## Tool Execution Protocol
When executing operations, the assistant should:
- Use calendar MCP server for: email operations (read, search, draft, send, organize) and calendar operations (check availability, create events, update, set reminders)
- Use RAG MCP server for: retrieving contextual information from knowledge base to inform decisions
- Follow multi-step workflows: For emails (read → summarize → extract → act), For calendar (check availability → find slot → create event → confirm)
- Ensure all tool parameters are complete before execution
- Structure tool calls clearly with explicit parameters

## Response Format Requirements
The assistant should return valid JSON containing:
{
  "decision": "approve|modify|reject|delegateBack",
  "reasoning": "Brief 1-2 sentence explanation of decision",
  "suggestedChanges": "Specific modifications needed (only for 'modify' decision)",
  "nextResponse": "Russian-language text for primary agent to speak to user (when applicable)"
}

## Language Requirement
The assistant should ensure ALL nextResponse content is in natural, conversational Russian that the primary agent can speak directly to the user without modification.

## Edge Cases and Error Handling
When encountering these situations, the assistant should:
- **Incomplete context**: Request decision = "modify" with suggestedChanges asking for missing information
- **Conflicting parameters**: Decision = "modify" explaining the conflict and requesting clarification
- **Tool unavailability**: Decision = "reject" with explanation and alternative approach in nextResponse
- **Ambiguous timeframes**: Decision = "modify" requesting specific dates/times from user
- **Multiple valid interpretations**: Decision = "modify" presenting options to user in Russian
- **Destructive operations**: Decision = "reject" unless explicit confirmation present in context

## Quality Standards
The assistant should ensure:
- Reasoning is concise (1-2 sentences maximum)
- Russian responses sound natural and conversational
- Tool parameters are explicitly specified
- Decision logic is consistent with complexity heuristics
- suggestedChanges provide actionable guidance, not vague suggestions
`;

/**
 * Fetches a response from the GPT-5 supervisor model via the Responses API
 */
async function fetchSupervisorResponse(body: any) {
  console.log('[supervisorAgent] fetchSupervisorResponse called');
  console.log('[supervisorAgent] Request body:', JSON.stringify(body, null, 2));

  try {
    const requestPayload = {
      ...body,
      parallel_tool_calls: false,
      model: 'gpt-5' // Use GPT-5 for supervisor
    };
    console.log('[supervisorAgent] Sending request to /api/responses with model:', requestPayload.model);

    const response = await fetch('/api/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('[supervisorAgent] Response status:', response.status, response.statusText);

    if (!response.ok) {
      console.warn('[supervisorAgent] Supervisor API returned an error:', response);
      return { error: 'Supervisor agent unavailable.' };
    }

    const completion = await response.json();
    console.log('[supervisorAgent] Received completion:', JSON.stringify(completion, null, 2));
    return completion;
  } catch (error) {
    console.error('[supervisorAgent] Error fetching supervisor response:', error);
    return { error: 'Network error contacting supervisor.' };
  }
}

/**
 * Handles tool calls from the supervisor agent if needed
 * Note: For the severstal assistant, most tool execution happens via MCP,
 * but this allows the supervisor to coordinate multi-step operations
 */
async function handleSupervisorToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
): Promise<SupervisorResponse> {
  console.log('[supervisorAgent] handleSupervisorToolCalls called');
  console.log('[supervisorAgent] Initial response:', JSON.stringify(response, null, 2));

  let currentResponse = response;
  let iterationCount = 0;

  while (true) {
    iterationCount++;
    console.log(`[supervisorAgent] Tool call handling iteration #${iterationCount}`);

    if (currentResponse?.error) {
      console.log('[supervisorAgent] Response contains error:', currentResponse.error);
      return {
        decision: 'reject',
        reasoning: 'Supervisor encountered an error',
        nextResponse: 'Извините, произошла ошибка. Попробуйте ещё раз.',
      };
    }

    const outputItems: any[] = currentResponse.output ?? [];
    console.log(`[supervisorAgent] Output items count: ${outputItems.length}`);
    console.log('[supervisorAgent] Output items:', JSON.stringify(outputItems, null, 2));

    const functionCalls = outputItems.filter((item) => item.type === 'function_call');
    console.log(`[supervisorAgent] Function calls found: ${functionCalls.length}`);

    if (functionCalls.length === 0) {
      console.log('[supervisorAgent] No function calls, extracting final response');
      // No more function calls – extract the supervisor's decision
      const assistantMessages = outputItems.filter((item) => item.type === 'message');
      console.log(`[supervisorAgent] Assistant messages count: ${assistantMessages.length}`);

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      console.log('[supervisorAgent] Final text to parse:', finalText);

      // Parse the JSON response from supervisor
      try {
        const supervisorResponse: SupervisorResponse = JSON.parse(finalText);
        console.log('[supervisorAgent] Parsed supervisor response:', JSON.stringify(supervisorResponse, null, 2));
        return supervisorResponse;
      } catch (parseError) {
        console.error('[supervisorAgent] Failed to parse supervisor response:', finalText);
        console.error('[supervisorAgent] Parse error:', parseError);
        return {
          decision: 'reject',
          reasoning: 'Invalid supervisor response format',
          nextResponse: 'Извините, не удалось обработать запрос.',
        };
      }
    }

    // Handle any tool calls from the supervisor (including RAG and calendar MCP tools)
    console.log('[supervisorAgent] Processing function calls');
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      console.log(`[supervisorAgent] Processing tool call: ${fName}`, args);

      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      }

      // Execute MCP tools directly through the supervisor
      // The MCP tools (calendar and RAG) are available and can be called
      let toolResult: any;

      try {
        // Find the matching MCP tool and execute it
        const mcpTool = supervisorMcpTools.find((t: any) => {
          // Check if this tool matches the function call
          // MCP tools expose their methods through the serverLabel
          return t && typeof t === 'object' && 'execute' in t;
        });

        if (mcpTool && typeof (mcpTool as any).execute === 'function') {
          // Execute the MCP tool
          console.log(`[supervisorAgent] Executing MCP tool: ${fName}`);
          toolResult = await (mcpTool as any).execute(args);
        } else {
          // Tool not found or not executable
          console.warn(`[supervisorAgent] Tool ${fName} not found in MCP tools, delegating to primary agent`);
          toolResult = {
            status: 'delegated',
            message: 'Tool execution delegated to primary agent via MCP',
          };
        }
      } catch (error) {
        console.error(`[supervisorAgent] Error executing tool ${fName}:`, error);
        toolResult = {
          status: 'error',
          message: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      console.log(`[supervisorAgent] Tool result for ${fName}:`, toolResult);

      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call result: ${fName}`, toolResult);
      }

      body.input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(toolResult),
        },
      );
    }

    console.log('[supervisorAgent] Fetching next supervisor response');
    currentResponse = await fetchSupervisorResponse(body);
  }
}

/**
 * Heuristic function to determine if a request should be delegated to the supervisor
 *
 * This uses prompt-level analysis to decide between:
 * - Simple tasks: handled by primary agent with direct MCP tool calls
 * - Complex tasks: delegated to GPT-5 supervisor for multi-step reasoning
 */
export function shouldDelegateToSupervisor(context: {
  userMessage: string;
  conversationHistory: RealtimeItem[];
  availableTools: string[];
}): boolean {
  console.log('[supervisorAgent] shouldDelegateToSupervisor called');
  console.log('[supervisorAgent] User message:', context.userMessage);
  console.log('[supervisorAgent] Conversation history length:', context.conversationHistory.length);
  console.log('[supervisorAgent] Available tools:', context.availableTools);

  const message = context.userMessage.toLowerCase();
  const historyLength = context.conversationHistory.length;

  // Heuristic 1: Multi-step operations requiring coordination
  // Examples: "read emails from Igor and schedule a meeting based on his availability"
  const multiStepIndicators = [
    'и затем', // and then
    'после этого', // after that
    'основываясь на', // based on
    'если', // if
    'в зависимости от', // depending on
    'проверь и', // check and
    'найди и', // find and
  ];
  const hasMultiStepPattern = multiStepIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 1 - hasMultiStepPattern:', hasMultiStepPattern);

  // Heuristic 2: Ambiguous temporal references requiring interpretation
  // Examples: "next available time", "when I'm free", "soon"
  const ambiguousTimeIndicators = [
    'когда удобно', // when convenient
    'ближайшее время', // nearest time
    'когда свободен', // when I'm free
    'скоро', // soon
    'в следующий раз', // next time
    'как можно быстрее', // as soon as possible
  ];
  const hasAmbiguousTime = ambiguousTimeIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 2 - hasAmbiguousTime:', hasAmbiguousTime);

  // Heuristic 3: Bulk operations or filtering with conditions
  // Examples: "all emails from last week about project X"
  const bulkOrFilterIndicators = [
    'все письма', // all emails
    'всех событий', // all events
    'каждое', // each
    'только те', // only those
    'кроме', // except
    'содержащие', // containing
  ];
  const hasBulkOperation = bulkOrFilterIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 3 - hasBulkOperation:', hasBulkOperation);

  // Heuristic 4: Requests requiring data synthesis or summarization
  // Examples: "summarize my meetings this week and suggest priorities"
  const synthesisIndicators = [
    'резюмируй', // summarize
    'подведи итог', // sum up
    'сравни', // compare
    'проанализируй', // analyze
    'предложи', // suggest
    'что важнее', // what's more important
  ];
  const requiresSynthesis = synthesisIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 4 - requiresSynthesis:', requiresSynthesis);

  // Heuristic 5: Error recovery or complex conversation context
  // If the conversation has many turns without resolution, escalate to supervisor
  const isLongConversation = historyLength > 8;
  const hasRepeatedClarifications = context.conversationHistory
    .filter(item => item.type === 'message' && item.role === 'assistant')
    .slice(-3)
    .some((item: any) => {
      const content = item.content?.[0]?.text || '';
      return content.includes('?') || content.includes('уточните');
    });
  console.log('[supervisorAgent] Heuristic 5 - isLongConversation:', isLongConversation, 'hasRepeatedClarifications:', hasRepeatedClarifications);

  // Heuristic 6: Explicit complexity keywords
  const complexityIndicators = [
    'сложный', // complex
    'несколько', // several
    'множество', // multiple
    'организуй', // organize
    'спланируй', // plan
  ];
  const hasComplexityKeyword = complexityIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 6 - hasComplexityKeyword:', hasComplexityKeyword);

  // Heuristic 7: Simple single-tool operations (should NOT delegate)
  const simpleSingleToolIndicators = [
    'прочитай последн', // read last
    'покажи последн', // show last
    'какое следующее событие', // what's next event
    'когда встреча с', // when is meeting with
  ];
  const isSimpleSingleTool = simpleSingleToolIndicators.some(indicator => message.includes(indicator));
  console.log('[supervisorAgent] Heuristic 7 - isSimpleSingleTool:', isSimpleSingleTool);

  // Decision logic: delegate if multiple heuristics suggest complexity
  const complexityScore = [
    hasMultiStepPattern,
    hasAmbiguousTime,
    hasBulkOperation,
    requiresSynthesis,
    isLongConversation && hasRepeatedClarifications,
    hasComplexityKeyword,
  ].filter(Boolean).length;

  console.log('[supervisorAgent] Complexity score:', complexityScore);

  // Don't delegate simple operations even if other heuristics match
  if (isSimpleSingleTool && complexityScore <= 1) {
    console.log('[supervisorAgent] Decision: DO NOT delegate (simple single-tool operation)');
    return false;
  }

  // Delegate if complexity score is 2 or higher
  const shouldDelegate = complexityScore >= 2;
  console.log('[supervisorAgent] Decision:', shouldDelegate ? 'DELEGATE to supervisor' : 'DO NOT delegate');
  return shouldDelegate;
}

/**
 * Tool that delegates complex requests to the GPT-5 supervisor agent
 *
 * This tool is called by the primary severstalAssistant when it determines
 * a request is too complex for direct tool execution and requires multi-step
 * reasoning, conditional logic, or data synthesis.
 */
export const delegateToSupervisor = tool({
  name: 'delegateToSupervisor',
  description:
    'Delegates complex tasks to a highly intelligent GPT-5 supervisor agent that can handle multi-step operations, conditional logic, and ambiguous requests requiring contextual understanding. Use this for tasks that require more than one tool call or sophisticated reasoning.',
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
    console.log('[supervisorAgent] Details context:', details?.context);

    const { conversationContext, proposedPlan, userIntent, complexity } = input as {
      conversationContext: string;
      proposedPlan: string;
      userIntent: string;
      complexity: 'high' | 'medium' | 'low';
    };

    console.log('[supervisorAgent] Extracted parameters:', {
      conversationContext,
      proposedPlan,
      userIntent,
      complexity,
    });

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    console.log('[supervisorAgent] History length:', history.length);

    // Build the request to the supervisor
    const supervisorRequest: SupervisorRequest = {
      conversationContext,
      proposedPlan,
      metadata: {
        userIntent,
        complexity,
        requiresMultipleTools: complexity !== 'low',
      },
    };

    console.log('[supervisorAgent] Supervisor request built:', JSON.stringify(supervisorRequest, null, 2));

    if (addBreadcrumb) {
      addBreadcrumb('[Supervisor] Request sent', supervisorRequest);
    }

    // Prepare the API request body with MCP tools
    const body: any = {
      model: 'gpt-5',
      input: [
        {
          type: 'message',
          role: 'system',
          content: supervisorAgentInstructions,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
${JSON.stringify(history.filter(item => item.type === 'message'), null, 2)}

==== Supervisor Request ====
${JSON.stringify(supervisorRequest, null, 2)}

Please analyze this request and provide a JSON response with your decision (approve/modify/reject/delegateBack), reasoning, and any suggested changes or nextResponse text in Russian.`,
        },
      ],
      tools: supervisorMcpTools, // MCP tools for calendar operations and RAG knowledge queries
    };

    console.log('[supervisorAgent] API request body prepared');

    // Get response from supervisor
    console.log('[supervisorAgent] Calling fetchSupervisorResponse');
    const response = await fetchSupervisorResponse(body);

    if (response.error) {
      console.error('[supervisorAgent] Response contains error:', response.error);
      return {
        error: response.error,
        fallbackResponse: 'Извините, не могу обработать этот запрос. Попробуйте попроще?',
      };
    }

    // Handle any tool coordination from supervisor
    console.log('[supervisorAgent] Calling handleSupervisorToolCalls');
    const supervisorDecision = await handleSupervisorToolCalls(body, response, addBreadcrumb);

    console.log('[supervisorAgent] Supervisor decision received:', JSON.stringify(supervisorDecision, null, 2));

    if (addBreadcrumb) {
      addBreadcrumb('[Supervisor] Decision received', supervisorDecision);
    }

    // Return the supervisor's guidance to the primary agent
    const result = {
      decision: supervisorDecision.decision,
      reasoning: supervisorDecision.reasoning,
      suggestedChanges: supervisorDecision.suggestedChanges,
      nextResponse: supervisorDecision.nextResponse,
    };

    console.log('[supervisorAgent] Returning result to primary agent:', JSON.stringify(result, null, 2));
    return result;
  },
});
