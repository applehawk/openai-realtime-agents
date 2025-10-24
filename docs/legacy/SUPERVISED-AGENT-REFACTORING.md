# Supervisor Agent Refactoring

**Date:** 2025-10-22
**Status:** ✅ Completed
**Total Code Reduction:** -76% (640 lines → 151 lines)

---

## Overview

This document describes the complete refactoring of the Supervisor Agent delegation system from a low-level manual implementation to a clean, Agent SDK-based architecture with intelligent delegation.

## Motivation

### Problems with Original Implementation

1. **Manual tool call handling** - 150+ lines of boilerplate code to manage tool execution loops
2. **Client-side complexity heuristics** - 200+ lines of hardcoded Russian phrase matching
3. **Duplicated logic** - Both client and server evaluated task complexity
4. **Brittle patterns** - Failed with phrasing variations
5. **Hard to maintain** - Required code changes to adjust behavior
6. **Over-engineering** - Reinventing functionality already provided by OpenAI Agents SDK

### Goals

1. Migrate to OpenAI Agents SDK for automatic tool call handling
2. Remove client-side complexity heuristics
3. Let GPT-4o intelligence drive delegation decisions
4. Create self-correcting architecture via `delegateBack`
5. Reduce code complexity and improve maintainability

---

## Refactoring Summary

### Phase 1: Migration to Agent SDK

**Objective:** Replace manual API calls and tool handling with Agent SDK

#### Changes Made

1. **Created server-side Agent** ([/api/supervisor/agent.ts](../src/app/api/supervisor/agent.ts))
   ```typescript
   import { Agent } from '@openai/agents';

   export const supervisorAgent = new Agent({
     name: 'SupervisorAgent',
     model: 'gpt-4o',
     instructions: supervisorAgentInstructions,
     tools: [
       hostedMcpTool({
         serverLabel: 'calendar',
         serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
       }),
     ],
   });
   ```

2. **Created API endpoint** ([/api/supervisor/route.ts](../src/app/api/supervisor/route.ts))
   ```typescript
   import { run } from '@openai/agents';

   export async function POST(req: NextRequest) {
     // ... request validation ...

     // SDK handles everything automatically!
     const result = await run(supervisorAgent, input);

     return NextResponse.json(supervisorResponse);
   }
   ```

3. **Simplified delegateToSupervisor tool** ([supervisorAgent.ts](../src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts))
   - Removed `fetchSupervisorResponse()` - replaced by SDK's `run()`
   - Removed `handleSupervisorToolCalls()` - SDK handles automatically
   - Removed manual tool call loop (150+ lines)
   - Simple fetch to `/api/supervisor` endpoint

**Result:** 640 lines → 259 lines (-59%)

---

### Phase 2: Remove Client-Side Heuristics

**Objective:** Replace hardcoded complexity scoring with GPT-4o intelligence

#### Changes Made

1. **Deprecated `shouldDelegateToSupervisor()`** ([supervisorAgent.ts](../src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts))

   **Before (200+ lines):**
   ```typescript
   export function shouldDelegateToSupervisor(context: {
     userMessage: string;
     conversationHistory: RealtimeItem[];
     availableTools: string[];
   }): boolean {
     const multiStepIndicators = ['и затем', 'после этого', 'если', ...];
     const ambiguousTimeIndicators = ['когда удобно', 'ближайшее время', ...];
     const bulkOrFilterIndicators = ['все письма', 'всех событий', ...];
     const synthesisIndicators = ['резюмируй', 'сравни', ...];
     const complexityIndicators = ['сложный', 'несколько', ...];
     const simpleSingleToolIndicators = ['прочитай последн', ...];

     const complexityScore = [
       hasMultiStepPattern,
       hasAmbiguousTime,
       hasBulkOperation,
       requiresSynthesis,
       isLongConversation && hasRepeatedClarifications,
       hasComplexityKeyword,
     ].filter(Boolean).length;

     if (isSimpleSingleTool && complexityScore <= 1) return false;
     return complexityScore >= 2;
   }
   ```

   **After (10 lines):**
   ```typescript
   /**
    * @deprecated RealtimeAgent now decides delegation based on instructions
    */
   export function shouldDelegateToSupervisor(_context: any): boolean {
     console.warn('shouldDelegateToSupervisor is DEPRECATED');
     return true; // Let supervisor decide via delegateBack
   }
   ```

2. **Updated RealtimeAgent instructions** ([index.ts](../src/app/agentConfigs/severstalAssistantAgent/index.ts))

   Added clear delegation criteria:
   ```markdown
   **Supervisor Delegation** - Use delegateToSupervisor when the task requires:
   - Multiple sequential steps that depend on each other
   - Conditional logic or decision-making based on retrieved data
   - Ambiguous parameters that need interpretation
   - Cross-referencing or synthesis across multiple data sources
   - Bulk operations with filtering
   - Analysis or summarization

   **IMPORTANT**: When in doubt, prefer delegation. The supervisor is
   intelligent and will delegateBack if the task is actually simple.
   ```

3. **Enhanced Supervisor instructions** ([/api/supervisor/agent.ts](../src/app/api/supervisor/agent.ts))

   Emphasized `delegateBack` capability:
   ```markdown
   **delegateBack** - When the primary agent can handle this independently
   (PREFERRED when applicable)
   - Only single tool call required with clear parameters
   - No conditional logic or multi-step coordination needed
   - User intent is completely unambiguous
   - **Use this liberally** - the primary agent is capable of
     handling straightforward tasks
   ```

**Result:** 259 lines → 151 lines (additional -42%)

---

## New Architecture

### Intelligent Delegation Flow

```
┌─────────────────────────────────────────┐
│   RealtimeAgent (Client)                │
│                                         │
│   Evaluates request complexity          │
│   based on INSTRUCTIONS, not code       │
│   ↓                                     │
│   Calls delegateToSupervisor when:      │
│   • Multi-step operations               │
│   • Ambiguous parameters                │
│   • Analysis/synthesis needed           │
│   • When in doubt (better safe!)        │
└──────────────┬──────────────────────────┘
               │
               │ POST /api/supervisor
               │ {context, plan, intent, complexity}
               ↓
┌─────────────────────────────────────────┐
│   Supervisor Agent (Server, gpt-4o)     │
│                                         │
│   Analyzes delegation request           │
│   ↓                                     │
│   Returns one of:                       │
│   • delegateBack - "too simple for me" │
│   • approve - "I'll handle it"         │
│   • modify - "need more info"          │
│   • reject - "can't do this"           │
│                                         │
│   SDK automatically handles:            │
│   ✅ Tool call loops                    │
│   ✅ MCP tool execution                 │
│   ✅ Error recovery                     │
└─────────────────────────────────────────┘
```

### Key Principles

1. **Trust GPT-4o Intelligence**
   - Let the model decide complexity, not hardcoded rules
   - Adapts to phrasing variations automatically
   - Learns from context, not just keywords

2. **Self-Correcting Architecture**
   - RealtimeAgent can over-delegate without penalty
   - Supervisor returns `delegateBack` for simple tasks
   - Single source of truth for complexity assessment

3. **Prompt Engineering Over Code**
   - Behavior changes via instruction updates
   - No code deploys for tuning
   - Easy A/B testing of delegation strategies

---

## Comparison: Before vs After

### Before: Hard-coded Rules

```typescript
// ❌ Brittle pattern matching
const multiStepIndicators = [
  'и затем',      // and then
  'после этого',  // after that
  'основываясь на', // based on
  'если',         // if
  // ... more patterns
];

const hasMultiStepPattern = multiStepIndicators.some(
  indicator => message.includes(indicator)
);

// ❌ Complex scoring logic
const complexityScore = [
  hasMultiStepPattern,
  hasAmbiguousTime,
  hasBulkOperation,
  requiresSynthesis,
  isLongConversation && hasRepeatedClarifications,
  hasComplexityKeyword,
].filter(Boolean).length;

// ❌ Arbitrary threshold
if (complexityScore >= 2) {
  delegate();
}
```

**Problems:**
- ❌ Breaks with phrasing variations ("если" vs "в случае если")
- ❌ Language-specific (Russian only)
- ❌ Hard to update (code changes required)
- ❌ Duplicated logic (client + server both evaluate)
- ❌ No self-correction

### After: Intelligence-based

**RealtimeAgent Instructions:**
```markdown
**Supervisor Delegation** - Use delegateToSupervisor when the task requires:
- Multiple sequential steps that depend on each other
- Conditional logic or decision-making based on retrieved data
- Ambiguous parameters that need interpretation

**IMPORTANT**: When in doubt, prefer delegation. The supervisor
will delegateBack if the task is actually simple.
```

**Supervisor Instructions:**
```markdown
**delegateBack** - When the primary agent can handle this independently
- Only single tool call required with clear parameters
- **Use this liberally** - the primary agent is capable
```

**Benefits:**
- ✅ Adapts to phrasing variations
- ✅ Language-agnostic (GPT-4o understands intent)
- ✅ Easy to tune (prompt updates)
- ✅ Self-correcting (delegateBack mechanism)
- ✅ Single source of truth

---

## Code Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total lines** | 640 | 151 | **-76%** |
| **Tool execution** | Manual loop (150+ lines) | SDK `run()` | **-100%** |
| **Heuristics** | 200+ lines | Deprecated (10 lines) | **-95%** |
| **Complexity** | High | Low | **-** |
| **Maintainability** | Hard | Easy | **+** |
| **Flexibility** | Low | High | **+** |

### Detailed Breakdown

**Phase 1 (SDK Migration):**
- supervisorAgent.ts: 640 → 259 lines (-381, -59%)
- Removed:
  - `fetchSupervisorResponse()` (35 lines)
  - `handleSupervisorToolCalls()` (170 lines)
  - `supervisorAgentInstructions` (moved to Agent, 105 lines)
  - `supervisorMcpTools` (moved to Agent, 14 lines)

**Phase 2 (Remove Heuristics):**
- supervisorAgent.ts: 259 → 151 lines (-108, -42%)
- Removed:
  - `shouldDelegateToSupervisor()` complexity logic (128 lines)
  - Replaced with 10-line deprecated stub

**Total:**
- 640 → 151 lines
- **-489 lines (-76%)**

---

## Files Modified

### Created Files

1. **`src/app/api/supervisor/agent.ts`** (New)
   - Server-side `Agent` class with `gpt-4o`
   - Supervisor instructions and decision framework
   - MCP tools configuration

2. **`src/app/api/supervisor/route.ts`** (New)
   - Next.js API route handler
   - Integrates `run()` from OpenAI Agents SDK
   - Request validation and error handling

### Modified Files

3. **`src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts`**
   - Removed manual API calls and tool handling
   - Deprecated `shouldDelegateToSupervisor()`
   - Simplified `delegateToSupervisor` tool to simple fetch
   - 640 → 151 lines

4. **`src/app/agentConfigs/severstalAssistantAgent/index.ts`**
   - Updated RealtimeAgent instructions
   - Clarified when to delegate to supervisor
   - Emphasized "when in doubt, delegate"

---

## Testing & Validation

### Build Verification

```bash
✅ npm run build   # Success
✅ npm run lint    # No errors
✅ TypeScript compilation OK
✅ All endpoints created successfully
```

### Backward Compatibility

- `shouldDelegateToSupervisor()` kept as deprecated stub
- Returns `true` to allow all delegations
- Supervisor handles filtering via `delegateBack`
- Migration can happen gradually

### Expected Behavior

1. **Simple request:** "прочитай последнее письмо"
   - RealtimeAgent: Evaluates as simple
   - Action: Calls MCP tool directly
   - **OR** RealtimeAgent delegates → Supervisor returns `delegateBack`

2. **Complex request:** "прочитай письма от Игоря и создай встречу на основе его предложений"
   - RealtimeAgent: Evaluates as complex
   - Action: Calls `delegateToSupervisor`
   - Supervisor: Returns `approve` and executes multi-step workflow

3. **Ambiguous request:** "когда удобно встретиться?"
   - RealtimeAgent: Detects ambiguity
   - Action: Calls `delegateToSupervisor`
   - Supervisor: Returns `modify` requesting clarification

---

## Benefits

### 1. Code Quality

| Aspect | Before | After |
|--------|--------|-------|
| Lines of code | 640 | 151 |
| Cyclomatic complexity | High | Low |
| Duplication | Yes (client+server) | No |
| Coupling | Tight (hardcoded patterns) | Loose (prompts) |

### 2. Maintainability

- **Before:** Adjust delegation → modify code → test → deploy
- **After:** Adjust delegation → update prompt → test → done
- No code changes for behavior tuning
- Easy A/B testing of strategies

### 3. Flexibility

- **Language agnostic:** GPT-4o understands intent in any language
- **Adapts to variations:** No reliance on exact phrasing
- **Self-correcting:** `delegateBack` provides safety net
- **Context-aware:** Uses conversation history, not just keywords

### 4. Reliability

- **SDK handles edge cases:** Tool errors, retries, parsing
- **Tested at scale:** OpenAI's SDK is production-proven
- **Type-safe:** TypeScript support out of the box
- **Observable:** Built-in logging and debugging

---

## Lessons Learned

### 1. Don't Reinvent the Wheel

**Problem:** We manually implemented tool call loops, JSON parsing, error handling, etc.

**Solution:** OpenAI Agents SDK already provides this functionality, tested at scale.

**Takeaway:** Always check if SDK/framework provides the feature before building it yourself.

### 2. Trust the Intelligence

**Problem:** We used 200+ lines of hardcoded Russian phrases to detect complexity.

**Solution:** GPT-4o can evaluate complexity better than pattern matching.

**Takeaway:** Modern LLMs are sophisticated enough to make these decisions. Use prompts, not code.

### 3. Embrace Self-Correction

**Problem:** Fear of over-delegation led to complex client-side filtering.

**Solution:** Let supervisor return `delegateBack` for simple tasks.

**Takeaway:** Self-correcting architectures are more robust than trying to prevent all errors upfront.

### 4. Optimize for Change

**Problem:** Every delegation strategy change required code modifications.

**Solution:** Behavior driven by prompts, not code.

**Takeaway:** Optimize for ease of iteration, not just initial correctness.

---

## Migration Guide

If you're migrating from the old implementation:

### Step 1: Update Dependencies

Ensure you have `@openai/agents` installed:
```bash
npm install @openai/agents
```

### Step 2: Review Instructions

Check that your RealtimeAgent instructions clearly describe when to delegate:
- See `src/app/agentConfigs/severstalAssistantAgent/index.ts` for reference
- Add guidance: "When in doubt, delegate - supervisor will delegateBack if needed"

### Step 3: Test Delegation Flow

1. Test simple requests → should execute directly or get `delegateBack`
2. Test complex requests → should delegate and supervisor approves
3. Test ambiguous requests → should delegate and supervisor asks for clarification

### Step 4: Remove Old Code

Once confident in new system:
```typescript
// Remove or fully deprecate shouldDelegateToSupervisor()
// It's no longer needed
```

---

## Future Improvements

### 1. Metrics & Observability

Add tracking for:
- Delegation rate (% of requests delegated)
- DelegateBack rate (% of delegations returned)
- Supervisor decision distribution (approve/modify/reject/delegateBack)

### 2. Adaptive Learning

- Log successful vs failed delegations
- Use feedback to improve prompts
- A/B test different delegation strategies

### 3. Cost Optimization

- Monitor GPT-4o API costs from supervisor calls
- Optimize when to use supervisor vs RealtimeAgent
- Consider caching for common patterns

### 4. Multi-Language Support

- Test with other languages (English, etc.)
- Validate GPT-4o handles multi-lingual delegation
- Add language-specific examples to prompts

---

## References

### Documentation

- [OpenAI Agents SDK - Voice Agents](https://openai.github.io/openai-agents-js/guides/voice-agents/build/)
- [OpenAI Agents SDK - Models](https://openai.github.io/openai-agents-js/guides/models/)
- [OpenAI Agents SDK - MCP Integration](https://openai.github.io/openai-agents-js/guides/mcp/)

### Related Files

- [Supervisor Agent](../src/app/api/supervisor/agent.ts)
- [Supervisor Route](../src/app/api/supervisor/route.ts)
- [Supervisor Tool](../src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts)
- [RealtimeAgent Config](../src/app/agentConfigs/severstalAssistantAgent/index.ts)

### Architecture Patterns

- **Chat-Supervisor Pattern:** Voice agent (low-latency) delegates complex tasks to supervisor (high-intelligence)
- **Self-Correcting Delegation:** Supervisor can return tasks to primary agent via `delegateBack`
- **Tool-based Delegation:** RealtimeAgent calls server-side Agent through tool interface

---

## Conclusion

This refactoring demonstrates the power of:

1. **Using the right tools:** OpenAI Agents SDK eliminates boilerplate
2. **Trusting AI intelligence:** GPT-4o evaluates complexity better than hardcoded rules
3. **Self-correcting systems:** `delegateBack` provides safety net for over-delegation
4. **Prompt engineering:** Behavior changes via instructions, not code

**Result:** 76% less code, significantly better maintainability, and more intelligent delegation.

---

**Contributors:** Claude (AI Assistant), Vladimir (Developer)
**Last Updated:** 2025-10-22
