# Perplexity Research Tool - Integration Summary

## ✅ Completed Integration

### 1. Tool Implementation
**File**: [perplexityResearch.ts](./perplexityResearch.ts)
- ✅ Created using OpenAI SDK pattern (per Perplexity docs)
- ✅ Supports 3 models: `sonar`, `sonar-pro`, `sonar-reasoning-pro`
- ✅ Simple interface with comprehensive error handling
- ✅ TypeScript types exported for reusability

### 2. Agent Integration
**File**: [executor.ts](../agents/executor.ts)
```typescript
import { perplexityResearch } from '../tools/perplexityResearch';

export const executorAgent = new Agent({
  tools: [perplexityResearch],
});
```

### 3. Agent Instructions Updated
**File**: [executor.ts prompts](../prompts/executor.ts)

Added comprehensive guidance:

#### When to Use perplexityResearch
- Current events or recent information
- Factual data from web sources
- Technical documentation lookup
- External companies, products, technologies
- User explicitly asks to "search" or "find online"
- Uncertainty requiring verification

#### When NOT to Use
- Internal company data (use MCP tools)
- Calendar/Email/File operations
- Data already in previousResults context

#### Examples Added
- **Web Research**: "Найди последние обновления в Next.js 15"
- **Combined**: Research company X + send email
- **Multi-step**: Research web → Send email

#### Principles Updated
- Principle #2: Choose right tool (perplexityResearch vs MCP)
- Principle #7: Track perplexityResearch calls in workflowSteps
- Principle #10: Cite sources from web research

### 4. Environment Configuration
**File**: [.env.sample](../../../../.env.sample)
```bash
PERPLEXITY_API_KEY=your_perplexity_api_key
```

### 5. Documentation
- ✅ [README.md](./README.md) - Full documentation
- ✅ [EXAMPLES.md](./EXAMPLES.md) - Usage examples
- ✅ [index.ts](./index.ts) - Central export point

## 🎯 How It Works Now

### Execution Flow

1. **User asks question** → "Найди информацию о React 19"

2. **complexityAssessorAgent2** evaluates complexity

3. **executorAgent receives task** with instructions

4. **Agent reads instructions** and sees:
   - Tool available: `perplexityResearch`
   - When to use: "Technical questions requiring documentation"
   - Example: "Найди информацию о последних обновлениях Next.js"

5. **Agent calls perplexityResearch**:
   ```json
   {
     "query": "Latest features and updates in React 19",
     "model": "sonar-pro"
   }
   ```

6. **Tool executes**:
   - Creates OpenAI client pointing to Perplexity API
   - Sends chat completion request
   - Returns synthesized answer with metadata

7. **Agent returns result**:
   ```json
   {
     "status": "completed",
     "result": "Изучил информацию о React 19. Основные обновления: новый компилятор React Compiler, улучшения Server Components, Actions API стал стабильным...",
     "workflowSteps": [
       "Выполнил веб-поиск через perplexityResearch",
       "Синтезировал информацию из источников"
     ]
   }
   ```

## 🔧 Integration Points

### Current Integrations
- ✅ **executorAgent** - Primary integration for task execution

### Potential Integrations
Can be added to any agent by importing:

```typescript
import { perplexityResearch } from '../tools';

export const myAgent = new Agent({
  tools: [perplexityResearch],
});
```

**Candidates**:
- `workflowOrchestratorAgent` - For complex workflows requiring research
- `routerAgent` (severstalAssistant) - For voice assistant web access
- Any realtime agents needing web information

## 📊 Tool Capabilities

### Input Parameters
```typescript
{
  query: string;              // Required: research query
  model?: string;             // Optional: sonar | sonar-pro | sonar-reasoning-pro
  systemPrompt?: string;      // Optional: custom system prompt
}
```

### Output Format
```typescript
{
  success: boolean;
  answer?: string;           // Synthesized answer from web
  metadata?: {
    model: string;
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
  };
  error?: string;            // If failed
}
```

## 🚀 Testing

### Quick Test
1. Add `PERPLEXITY_API_KEY` to `.env`
2. Restart development server
3. Ask voice assistant: "Найди последние обновления в Next.js"
4. Check console for `[perplexityResearch]` logs

### Manual Test
```typescript
import { perplexityResearch } from './tools';

const result = await perplexityResearch.execute({
  query: 'What is Next.js?',
}, {});

console.log(result);
```

## 📝 Key Design Decisions

### 1. OpenAI SDK Approach
**Why**: Official Perplexity docs recommend this pattern
**Benefit**: Simple, maintainable, compatible with existing OpenAI infrastructure

### 2. Integrated in executorAgent
**Why**: Executor handles direct task execution
**Benefit**: Available for both simple and complex task hierarchies

### 3. Comprehensive Instructions
**Why**: Agent needs clear guidance on when/how to use tool
**Benefit**: Prevents misuse, ensures appropriate tool selection

### 4. Optional systemPrompt
**Why**: Flexibility for specialized research
**Benefit**: Can customize research focus per query

## 🔍 Monitoring

Console logs include:
```
[perplexityResearch] Executing search: {query, model}
[perplexityResearch] Search completed: {tokensUsed, model}
[perplexityResearch] Search failed: {error}
```

## 📖 References

- Perplexity Integration Docs: https://docs.perplexity.ai/cookbook/articles/openai-agents-integration/README
- Perplexity API Docs: https://docs.perplexity.ai/guides/chat-completions-sdk
- OpenAI Agents SDK: https://github.com/openai/openai-agents-sdk

## ✨ Next Steps

1. **Add API Key**: Add `PERPLEXITY_API_KEY` to production `.env`
2. **Test**: Verify with test queries
3. **Monitor**: Check token usage and costs
4. **Expand** (optional): Add to other agents as needed

## 🎉 Summary

The integration is **complete and ready to use**. The executorAgent now has web research capabilities and knows exactly when and how to use them based on comprehensive instructions.
