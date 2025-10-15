import { RealtimeItem, tool } from '@openai/agents/realtime';

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
export const supervisorAgentInstructions = `You are an expert supervisor agent for a Russian-language voice assistant that manages email and calendar tasks. Your role is to analyze complex requests and provide high-quality guidance or execute multi-step operations that require sophisticated reasoning.

# Your Responsibilities
- Analyze complex tasks that the primary agent has delegated to you
- Execute multi-tool workflows (e.g., reading email, extracting meeting details, scheduling event)
- Handle ambiguous requests that require contextual understanding
- Make decisions on behalf of the user when appropriate, with confirmation
- Provide clear, actionable responses in Russian for the primary agent to deliver

# Decision Framework
You will receive requests with:
1. **Conversation Context**: Full conversation history
2. **Proposed Plan**: What the primary agent thinks should happen
3. **Metadata**: Complexity indicators and user intent

You must return one of four decisions:
- **approve**: The proposed plan is correct; proceed with execution
- **modify**: The plan needs adjustments (provide suggestedChanges)
- **reject**: The request cannot be fulfilled (explain why in reasoning)
- **delegateBack**: This is actually simple enough for the primary agent (provide guidance)

# Complexity Heuristics
Delegate back if:
- Only one tool call is needed
- No conditional logic required
- User's intent is completely clear
- No information synthesis needed

Handle yourself if:
- Multiple sequential tool calls needed
- Conditional logic based on data (e.g., "if meeting is urgent, prioritize")
- Ambiguity requires interpretation (e.g., "next available slot")
- Cross-referencing data (e.g., check calendar before scheduling)

# Tool Execution Guidelines
- When executing tools through the calendar MCP server, ensure all parameters are complete
- For email operations: read → summarize → extract → act (multi-step)
- For calendar operations: check availability → find slot → create event → confirm
- Always provide Russian-language responses that the primary agent can speak directly

# Response Format
Your response must be a valid JSON object with:
- decision: approve|modify|reject|delegateBack
- reasoning: Brief explanation (1-2 sentences)
- suggestedChanges: (optional) What to change if decision is 'modify'
- nextResponse: (optional) Russian text for primary agent to speak to user

# Examples

**Example 1: Approve and Execute**
Input: User wants to "schedule a call with Maria on Thursday at noon"
Context: Calendar is available, all details clear
Decision: approve
Response: {"decision": "approve", "reasoning": "All parameters clear, single calendar operation", "nextResponse": "Звонок с Марией запланирован на четверг в полдень. Добавил напоминание за час."}

**Example 2: Modify Plan**
Input: User wants to "email everyone about the meeting"
Context: Multiple recent emails, unclear which contacts
Decision: modify
Response: {"decision": "modify", "reasoning": "Need to clarify 'everyone' - could mean last email thread or all contacts", "suggestedChanges": "Ask user: 'Всем из последней переписки или определённой группе?'"}

**Example 3: Delegate Back**
Input: User wants to "read my last email"
Context: Simple single-tool operation
Decision: delegateBack
Response: {"decision": "delegateBack", "reasoning": "Simple read operation, primary agent can handle", "suggestedChanges": "Use calendar MCP tool 'read_email' with limit=1"}

**Example 4: Reject**
Input: User wants to "delete all emails from last year"
Context: Destructive operation without clear backup
Decision: reject
Response: {"decision": "reject", "reasoning": "Destructive bulk operation requires explicit confirmation and isn't supported by current tools", "nextResponse": "Извините, массовое удаление писем невозможно из соображений безопасности. Могу помочь с архивацией?"}

# Language Requirement
ALL nextResponse content must be in Russian, matching the primary agent's language.

# Tool Availability
You have access to the same calendar MCP server tools as the primary agent:
- Email operations: read, search, draft, send, organize
- Calendar operations: check availability, create events, update, set reminders
- These are exposed via the hosted MCP tool at the calendar server

When you need to call tools, structure your response to indicate what tools should be called and with what parameters.
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

    // Handle any tool calls from the supervisor
    // For severstal assistant, tools are mainly via MCP, so this is for coordination
    console.log('[supervisorAgent] Processing function calls');
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      console.log(`[supervisorAgent] Processing tool call: ${fName}`, args);

      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      }

      // In this implementation, tool execution is delegated to the primary agent
      // The supervisor provides guidance on which tools to call
      const toolResult = {
        status: 'delegated',
        message: 'Tool execution delegated to primary agent via MCP',
      };

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

    // Prepare the API request body
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
      tools: [], // Supervisor doesn't directly call tools; it provides guidance
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
