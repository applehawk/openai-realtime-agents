# SeverstalAssistant with GPT-5 Supervisor Delegation

This directory contains the implementation of the **severstalAssistant** agent with intelligent supervisory delegation to a GPT-5 supervisor for complex tasks.

## Architecture Overview

The severstalAssistant uses a **dual-path architecture** similar to the `chatSupervisor` pattern but optimized for Russian-language email and calendar management:

```
┌─────────────────────────────────────────────────────────────┐
│                  User Request (Russian)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   Primary Agent (gpt-4o-mini) │
         │   severstalAssistant          │
         └───────────┬───────────────────┘
                     │
         ┌───────────▼───────────┐
         │  Complexity Analysis   │
         │  (Prompt-level logic)  │
         └───────┬───────┬────────┘
                 │       │
        Simple   │       │   Complex
                 │       │
                 ▼       ▼
    ┌──────────────┐  ┌─────────────────────────┐
    │ MCP Tools    │  │  Supervisor Agent       │
    │ (Calendar)   │  │  (GPT-5)                │
    │ - read_email │  │  - Multi-step reasoning │
    │ - create_event│ │  - Conditional logic    │
    │ - list_events│  │  - Data synthesis       │
    └──────────────┘  └─────────────────────────┘
```

## Files

### 1. `index.ts` - Primary Agent
The main RealtimeAgent that:
- Handles Russian-language voice/chat interactions
- Routes simple requests to MCP tools directly
- Delegates complex requests to the GPT-5 supervisor
- Exports the agent configuration and `shouldDelegateToSupervisor` utility

### 2. `supervisorAgent.ts` - Supervisor Logic
Contains:
- **Type Definitions**: `SupervisorDecision`, `SupervisorRequest`, `SupervisorResponse`
- **`shouldDelegateToSupervisor()`**: Heuristic function with 7 decision rules
- **`delegateToSupervisor`**: Tool for calling the GPT-5 supervisor
- **`supervisorAgentInstructions`**: Comprehensive prompt for the GPT-5 model
- **Tool Execution Handlers**: Manages multi-step supervisor responses

### 3. `supervisorAgent.test.md` - Test Specifications
Comprehensive test cases covering:
- Heuristic function behavior (simple vs complex detection)
- Tool parameter validation
- Mock supervisor responses for all decision types
- Error handling scenarios
- End-to-end integration workflows

## How It Works

### Decision Logic: Simple vs Complex

The primary agent uses **prompt-level instructions** to determine routing:

#### Route A: Direct MCP Tool Execution (Simple)
Used when:
- Request is clear and requires **only ONE tool call**
- No conditional logic needed
- Examples:
  - "Прочитай последнее письмо" (Read last email)
  - "Покажи встречи на сегодня" (Show today's meetings)
  - "Когда встреча с Игорем?" (When is meeting with Igor?)

#### Route B: Supervisor Delegation (Complex)
Used when detecting:
1. **Multi-step operations**: Keywords like "и затем", "после этого", "если"
2. **Ambiguous timing**: "когда удобно", "ближайшее время", "как можно быстрее"
3. **Bulk/filtered operations**: "все письма о проекте", "только те события"
4. **Data synthesis**: "резюмируй", "сравни", "проанализируй", "предложи"
5. **Long conversations**: 8+ turns with repeated clarifications
6. **Explicit complexity**: "сложный", "несколько", "множество", "организуй"
7. **NOT simple**: Negative check for single-tool patterns

### Heuristic Function

```typescript
shouldDelegateToSupervisor({
  userMessage: string,
  conversationHistory: RealtimeItem[],
  availableTools: string[]
}): boolean
```

**Scoring System:**
- Each heuristic that matches adds +1 to complexity score
- Score ≥ 2 → Delegate to supervisor
- Simple single-tool patterns override even with score > 1

### Supervisor Decisions

The GPT-5 supervisor returns one of four decisions:

| Decision | Meaning | Next Action |
|----------|---------|-------------|
| `approve` | Plan is correct | Execute as proposed, use `nextResponse` |
| `modify` | Plan needs changes | Use `suggestedChanges` to adjust approach |
| `reject` | Cannot fulfill | Explain to user via `nextResponse` |
| `delegateBack` | Actually simple | Primary agent can handle with guidance |

### Tool Call Flow

```typescript
// 1. Primary agent detects complexity
"Секундочку, проверю." // Filler phrase

// 2. Call delegateToSupervisor
{
  conversationContext: "User wants to read emails from Maria and schedule mentioned meetings",
  proposedPlan: "Read emails, parse for meeting details, create calendar event",
  userIntent: "schedule meeting based on email content",
  complexity: "high"
}

// 3. Supervisor analyzes and responds
{
  decision: "approve",
  reasoning: "Multi-step operation with conditional logic",
  nextResponse: "Нашёл встречу в письме от Марии. Запланировал на среду в 14:00."
}

// 4. Primary agent speaks response verbatim
"Нашёl встречу в письме от Марии. Запланировал на среду в 14:00."
```

## Integration with MCP

The agent uses the hosted MCP tool for Google Calendar/Gmail operations:

```typescript
hostedMcpTool({
  serverLabel: 'calendar',
  serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
})
```

The supervisor **does not directly call MCP tools**. Instead, it:
1. Provides guidance on which tools to call
2. Coordinates multi-step operations
3. Returns Russian-language responses for the primary agent to speak

## Example Scenarios

### Scenario 1: Simple Request (No Delegation)
```
User: Прочитай последнее письмо
Agent: [Calls MCP read_email directly]
Agent: Последнее письмо от Игоря о встрече завтра.
```

### Scenario 2: Complex Multi-Step (Delegation)
```
User: Прочитай письма от Марии и если там встреча, запланируй её
Agent: Секундочку, проверю.
Agent: [Calls delegateToSupervisor]
Supervisor: {decision: "approve", nextResponse: "..."}
Agent: Нашёл встречу в письме. Запланировал на среду в 14:00.
```

### Scenario 3: Ambiguous Request (Modification)
```
User: Отправь всем письмо о встрече
Agent: Один момент, уточню детали.
Agent: [Calls delegateToSupervisor]
Supervisor: {decision: "modify", nextResponse: "Уточните..."}
Agent: Уточните, пожалуйста: всем сотрудникам или определённой группе?
```

## Testing

Since the project doesn't have a test runner configured, the test specifications in `supervisorAgent.test.md` serve as:
1. **Documentation** of expected behavior
2. **Manual testing guide** for verification
3. **Future test implementation** when a framework is added

To add automated testing:
```bash
npm install --save-dev jest @types/jest ts-jest
# Configure Jest
# Rename supervisorAgent.test.md to supervisorAgent.test.ts
npm test
```

## Configuration

### Environment Variables
Requires `OPENAI_API_KEY` for both:
- Primary agent (gpt-4o-realtime-mini)
- Supervisor agent (gpt-5)

### API Endpoint
Supervisor calls go through `/api/responses` which proxies to OpenAI's Responses API:
```typescript
POST /api/responses
{
  model: 'gpt-5',
  input: [...],
  tools: []
}
```

## Prompt Engineering Notes

### Filler Phrases
The primary agent **must** say a filler phrase before calling the supervisor:
- "Секундочку, уточню детали."
- "Один момент, проверю."
- "Сейчас подумаю, как лучше."

This maintains natural conversation flow and sets user expectations.

### Russian Language Enforcement
Both agents **strictly enforce Russian**:
- All `nextResponse` content must be in Russian
- If user tries another language: "Извините, поддерживается только русский язык."

### Brevity Requirements
- Aim for 5-20 words per response
- Split information over multiple turns
- Favor back-and-forth interaction
- Voice-optimized (no bullet lists)

## Known Limitations

1. **GPT-5 Availability**: Assumes GPT-5 model is available. Falls back to error handling if not.
2. **No Direct Tool Execution**: Supervisor provides guidance only; primary agent must execute tools.
3. **Russian-Only**: Will not handle other languages gracefully in multi-lingual environments.
4. **Test Framework**: No automated tests currently; manual verification required.

## Future Enhancements

1. **Adaptive Heuristics**: Learn from successful/failed delegations to tune thresholds
2. **Caching**: Cache common supervisor decisions for faster responses
3. **Metrics**: Track delegation rates, supervisor decision distributions
4. **Fallback Models**: Use gpt-4.1 if gpt-5 unavailable
5. **Multi-language**: Extend to other languages with similar patterns

## References

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-js/)
- [Tools Guide](https://openai.github.io/openai-agents-js/guides/tools/)
- [chatSupervisor Pattern](../chatSupervisor/) - Similar implementation for English

## Commit

```
feat(agent): add supervisory delegation logic to severstalAssistant (gpt-5 supervisor)
```

All code follows the OpenAI Agents SDK patterns and is TypeScript-safe.