# Supervisor Prompt Guide - supervisorAgentInstructions

**File:** [src/app/api/supervisor/agent.ts](../../../src/app/api/supervisor/agent.ts)
**Lines:** 35-551 (517 lines of instructions)
**Model:** GPT-4o
**Version:** 2.0
**Date:** 2025-10-24

---

## Overview

`supervisorAgentInstructions` — это детальный промпт (551 строк), который определяет поведение SupervisorAgent (GPT-4o) при обработке делегированных задач от RealtimeAgent и IntelligentSupervisor.

**Ключевые характеристики:**
- Поддерживает 4 типа решений: `approve`, `modify`, `reject`, `delegateBack`
- Работает в 2 режимах: **PLAN FIRST** vs **EXECUTE IMMEDIATELY**
- Включает критерии сложности задач (simple/medium/complex)
- Определяет формат ответов (nextResponse, workflowSteps, plannedSteps)
- Содержит voice-optimized formatting rules

---

## Prompt Structure

### Section 1: Role & Objective (lines 36-50)

**Purpose:** Defines supervisor's expertise and success criteria

```markdown
You are an expert supervisor agent for a Russian-language voice assistant.

Primary Focus Areas:
- Email and calendar management
- Knowledge retrieval and synthesis
- Multi-step task orchestration
- Cross-referencing and data synthesis

Success Criteria:
- Correctly identify when tasks can be delegated back
- Execute complex multi-step workflows efficiently
- Provide natural, conversational Russian responses
- Maintain consistency with primary agent's style
```

**Used by:** All IntelligentSupervisor methods (sets overall context)

---

### Section 2: Context (lines 62-82)

**Purpose:** Explains primary agent's capabilities (RealtimeAgent v2.0)

```markdown
The primary agent uses improved prompting v2.0 with:
- Explicit tool selection matrix
- Three execution paths (Direct MCP / Supervisor / RAG)
- Adaptive brevity (3-5 words confirmations, 10-20 answers)
- Per-tool confirmation rules
- Preambles before tool calls
```

**Why important:** Supervisor knows when to `delegateBack` vs `approve`

---

### Section 3: Decision Framework (lines 93-200)

#### 3.1 delegateBack (lines 97-113)

**When to use:**
```typescript
✅ Only single tool call required
✅ No conditional logic needed
✅ User intent is completely unambiguous
✅ Task matches primary agent's Direct Tool Execution criteria
```

**Response format:**
```json
{
  "decision": "delegateBack",
  "reasoning": "Single straightforward action...",
  "nextResponse": "Используй read_email MCP. Ответь: 'Смотрю почту'"
}
```

**Used by:** `assessComplexity()` when task is actually simple

#### 3.2 approve (lines 115-170)

**Two modes:**

**MODE 1: PLAN FIRST** (lines 127-146)

When:
- ✅ 5+ steps requiring user review
- ✅ Irreversible actions (sending emails, creating events)
- ✅ Ambiguous aspects needing confirmation

Response:
```json
{
  "decision": "approve",
  "reasoning": "...",
  "nextResponse": "Я составил план... Хотите, чтобы я выполнил?",
  "plannedSteps": [
    "Прочитаю письмо от Анны (будущее время)",
    "Проверю календарь на конфликты",
    "Создам событие если свободно"
  ]
}
```

**Used by:** `generatePlan()` in IntelligentSupervisor

**MODE 2: EXECUTE IMMEDIATELY** (lines 147-170)

When:
- ✅ 2-4 steps, straightforward, low-risk
- ✅ Actions are reversible or non-destructive
- ✅ User clearly wants immediate execution

Response:
```json
{
  "decision": "approve",
  "reasoning": "...",
  "nextResponse": "Я прочитал письмо от Анны... (40-100+ words)",
  "workflowSteps": [
    "Прочитал письмо от Анны (прошедшее время)",
    "Извлёк время встречи",
    "Проверил календарь",
    "Создал событие"
  ]
}
```

**Used by:**
- `executeDirectly()` (simple tasks)
- `executeFlatWorkflow()` (medium tasks)
- `executeSingleTaskWithAgent()` (hierarchical leaf tasks)

#### 3.3 modify (lines 172-187)

**When to use:**
```typescript
❌ Missing critical information
❌ Incorrect tool sequence
❌ Ambiguous timeframes
❌ Multiple valid interpretations
```

**Response:**
```json
{
  "decision": "modify",
  "reasoning": "...",
  "suggestedChanges": "Нужно уточнить название проекта",
  "nextResponse": "О каком проекте искать? И за какой период?"
}
```

#### 3.4 reject (lines 189-200)

**When to use:**
```typescript
❌ Destructive operations without confirmation
❌ Tasks beyond available tool capabilities
❌ Privacy violations
```

**Response:**
```json
{
  "decision": "reject",
  "reasoning": "...",
  "nextResponse": "К сожалению, не могу удалить все письма без подтверждения..."
}
```

---

### Section 4: Complexity Assessment Rules (lines 202-253)

**CRITICAL for IntelligentSupervisor.assessComplexity()**

#### Delegate Back Criteria (lines 207-220)

```markdown
✅ Single tool call with clear parameters
✅ Simple filtering (if MCP supports)
✅ Direct RAG queries
✅ Clear user intent with all parameters
✅ No cross-referencing needed
```

**Examples:**
- "Прочитай последнее письмо"
- "Покажи встречи на завтра"

#### Handle Personally (Approve) Criteria (lines 223-253)

```markdown
Multi-step operations:
✅ Sequential tool calls with dependencies

Conditional logic:
✅ Data-dependent decisions

Ambiguous parameters:
✅ Requiring interpretation ("когда удобно", "всем участникам")

Cross-referencing:
✅ Multiple data sources

Bulk operations with analysis:
✅ Filtering + summarization

Complex RAG workflows:
✅ RAG results need interpretation or follow-up actions
```

**Examples:**
- "Прочитай письмо от Анны и назначь встречу"
- "Найди все письма о проекте и резюмируй"

---

### Section 5: Response Format Requirements (lines 262-313)

#### JSON Response Structure

```json
{
  "decision": "approve|modify|reject|delegateBack",
  "reasoning": "Brief 1-2 sentence explanation",
  "suggestedChanges": "Specific modifications (only for 'modify')",
  "nextResponse": "Russian-language text for primary agent to speak",
  "plannedSteps": ["Future step 1", "..."], // OPTIONAL: PLAN FIRST mode
  "workflowSteps": ["Past step 1", "..."]   // REQUIRED: EXECUTE IMMEDIATELY mode
}
```

**CRITICAL:** Return ONLY JSON, no introductory text

#### plannedSteps Field (lines 276-289)

**When:** `decision === "approve"` AND task is VERY COMPLEX (5+ steps)

**Format:**
- Array of strings in Russian, **FUTURE tense**
- Each step: 10-20 words
- DO NOT execute yet — wait for user approval
- DO NOT include workflowSteps when using plannedSteps

**Example:**
```json
{
  "plannedSteps": [
    "Прочитаю письмо от Анны и извлеку предложенное время встречи",
    "Проверю ваш календарь на 15 января в 15:00 на наличие конфликтов",
    "Если время свободно, создам событие в календаре длительностью 1 час"
  ]
}
```

#### workflowSteps Field (lines 291-307)

**When:** `decision === "approve"` AND you ALREADY EXECUTED multiple steps

**Format:**
- Array of strings in Russian, **PAST tense**
- Each step: 5-15 words
- REQUIRED for transparency and debugging
- Use even for 2-step tasks
- DO NOT include plannedSteps when using workflowSteps

**Example:**
```json
{
  "workflowSteps": [
    "Прочитал письмо от Анны, отправленное сегодня в 10:30",
    "Извлёк время встречи: среда, 15 января, 15:00",
    "Проверил календарь — время свободно",
    "Создал событие в календаре на среду в 15:00"
  ]
}
```

**Choosing between plannedSteps and workflowSteps:**
- Very complex (5+), irreversible → `plannedSteps` (PLAN FIRST)
- Moderately complex (2-4), low-risk → `workflowSteps` (EXECUTE IMMEDIATELY)
- **NEVER use both in same response**

---

### Section 6: Language & Style Requirements (lines 315-359)

#### Response Length Guidelines

```typescript
// BE DETAILED - you are the smart supervisor (GPT-4o)

delegateBack guidance:  10-20 words
modify clarifications:  5-15 words
approve responses:      40-80+ words (can be 100+ for complex tasks)
reject explanations:    30-50 words
```

**IMPORTANT:** As intelligent supervisor, provide COMPREHENSIVE, DETAILED responses. Do NOT artificially limit length.

#### Voice-Optimized Formatting

```markdown
Dates:   "пятнадцатое января" (NOT "2025-01-15")
Times:   "три часа дня" or "пятнадцать ноль-ноль" (NOT "15:00")
Numbers: "три письма", "пять встреч" (spell out)
Lists:   "от Ивана, Анны и Петра" (natural enumeration)
```

#### Tone & Style

```markdown
✅ Friendly, upbeat, helpful
✅ Professional yet approachable
✅ DETAILED and INFORMATIVE
✅ THOROUGH — explain reasoning, steps, results
✅ Natural conversational flow
✅ Think: "expert assistant explaining complex tasks"

❌ No bullet points (not for voice)
❌ No technical jargon ("MCP", "RAG")
❌ Don't repeat known information
❌ Don't sound robotic
```

---

### Section 7: Examples (lines 400-547)

#### Example 1: Simple Task → delegateBack

**Request:**
```json
{
  "conversationContext": "Пользователь сказал: 'Прочитай последнее письмо'",
  "proposedPlan": "Использовать Calendar MCP для чтения последнего письма",
  "userIntent": "Прочитать последнее письмо",
  "complexity": "low"
}
```

**Response:**
```json
{
  "decision": "delegateBack",
  "reasoning": "Single straightforward action with clear parameters. Primary agent can handle directly.",
  "nextResponse": "Используй календарь MCP, инструмент read_email. Ответь: 'Смотрю почту'"
}
```

**Used by:** `assessComplexity()` when task is simple

#### Example 2: Multi-step → approve (EXECUTE IMMEDIATELY)

**Request:**
```json
{
  "conversationContext": "Пользователь: 'Прочитай письмо от Анны и назначь встречу'",
  "userIntent": "Назначить встречу на основе информации из письма"
}
```

**Response (GOOD - detailed):**
```json
{
  "decision": "approve",
  "reasoning": "Multi-step workflow: read email → extract time → create calendar event.",
  "nextResponse": "Я прочитал письмо от Анны, отправленное сегодня утром. Она предлагает встречу в среду, пятнадцатого января, в три часа дня. Тема встречи — обсуждение проекта 'Восток'. Я проверил ваш календарь на это время — у вас свободно. Встреча успешно запланирована на среду в пятнадцать ноль-ноль, длительность один час. Анна получит приглашение на почту.",
  "workflowSteps": [
    "Прочитал письмо от Анны от 22 января 10:30",
    "Извлёк данные встречи: среда 15 января 15:00, тема 'Проект Восток'",
    "Проверил календарь на 15 января 15:00 — свободно",
    "Создал событие в календаре: среда 15:00-16:00",
    "Отправил email-приглашение Анне (anna@company.com)"
  ]
}
```

**Used by:** `executeFlatWorkflow()` for medium tasks

#### Example 6: Very Complex Task → approve (PLAN FIRST)

**Request:**
```json
{
  "conversationContext": "Пользователь: 'Найди всех участников проекта Восток, проверь календари, отправь приглашения'",
  "userIntent": "Организовать встречу со всеми участниками"
}
```

**Response (PLAN FIRST):**
```json
{
  "decision": "approve",
  "reasoning": "Very complex multi-step task with 7+ steps, involves sending emails to multiple people.",
  "nextResponse": "Я составил план для организации встречи со всеми участниками проекта 'Восток'. Вот что я планирую сделать: сначала найду всех участников проекта через анализ переписки и извлеку их контакты. Затем проверю календари каждого участника на следующую неделю и найду время, когда все свободны. После этого создам событие в календаре на это время и отправлю приглашения всем участникам. Хотите, чтобы я выполнил этот план? Если да, уточните длительность встречи и предпочтительное время дня.",
  "plannedSteps": [
    "Выполню RAG запрос для поиска всех упоминаний участников проекта 'Восток'",
    "Извлеку список участников и их email-адреса из найденных писем",
    "Проверю календарь каждого участника на следующую неделю",
    "Найду временные слоты, когда все участники свободны одновременно",
    "Предложу пользователю 2-3 оптимальных варианта времени встречи",
    "После выбора времени создам событие в календаре",
    "Добавлю всех участников как приглашённых",
    "Отправлю email-приглашения всем участникам с темой и повесткой"
  ]
}
```

**Used by:** `generatePlan()` for very complex tasks

---

## How IntelligentSupervisor Uses the Prompt

### Usage Map

| Method | Purpose | Relevant Prompt Sections |
|--------|---------|--------------------------|
| `assessComplexity()` | Determine if task is simple/medium/complex | Complexity Assessment Rules (lines 202-253) |
| `executeDirectly()` | Execute simple 1-step task | Tool Execution Protocol (lines 254-260)<br>Response Format (lines 262-313) |
| `executeFlatWorkflow()` | Execute medium 2-7 step workflow | Approve → EXECUTE IMMEDIATELY (lines 147-170)<br>Language & Style (lines 315-359) |
| `generatePlan()` | Generate plan without execution (PLAN FIRST) | Approve → PLAN FIRST (lines 127-146)<br>plannedSteps format (lines 276-289) |
| `breakdownTaskWithSupervisor()` | Break task into subtasks (hierarchical) | Complexity Assessment (lines 223-253) |
| `executeSingleTaskWithAgent()` | Execute single leaf task (hierarchical) | Tool Execution Protocol (lines 254-260)<br>workflowSteps format (lines 291-307) |
| `generateReportWithSupervisor()` | Generate final hierarchical report | Response Format (lines 262-313) |

### Example: assessComplexity() Flow

```typescript
// IntelligentSupervisor.assessComplexity()

const assessmentPrompt = `
Оцени сложность следующей задачи:

**Задача:** ${taskDescription}
**Контекст разговора:** ${conversationContext}

**Твоя задача:**
Определи сложность задачи по следующим критериям:

**simple** (1 шаг, одно действие, все параметры известны)
**medium** (2-7 шагов, координация между шагами)
**complex** (8+ шагов, множественные источники данных)

**Верни ТОЛЬКО валидный JSON:**
{
  "complexity": "simple" | "medium" | "complex",
  "reasoning": "Краткое объяснение (1-2 предложения)"
}
`;

// SupervisorAgent processes this using:
// - Section 4: Complexity Assessment Rules (lines 202-253)
// - Section 5: Response Format Requirements (lines 262-313)

const result = await run(supervisorAgent, assessmentPrompt);
// Returns: { complexity: "medium", reasoning: "..." }
```

---

## Best Practices for Prompt Engineering

### DO ✅

1. **Use explicit criteria** for complexity assessment
   ```markdown
   **simple** (1 шаг): "Прочитай последнее письмо"
   **medium** (2-7 шагов): "Прочитай письмо и назначь встречу"
   **complex** (8+ шагов): "Найди всех участников и отправь приглашения"
   ```

2. **Always include examples** for each decision type
   - delegateBack example (simple task)
   - approve + workflowSteps example (EXECUTE IMMEDIATELY)
   - approve + plannedSteps example (PLAN FIRST)
   - modify example (missing info)
   - reject example (unsafe operation)

3. **Specify output format clearly**
   ```markdown
   **ВАЖНО:** Возвращай ТОЛЬКО JSON, без дополнительного текста!
   ```

4. **Provide voice-optimized formatting rules**
   - Dates: "пятнадцатое января" (NOT "2025-01-15")
   - Times: "три часа дня" (NOT "15:00")

### DON'T ❌

1. **Don't mix plannedSteps and workflowSteps** in same response
   - Either plan OR execute, not both

2. **Don't use vague criteria**
   ```diff
   - "Complex tasks require supervisor"
   + "Tasks with 8+ steps, multiple data sources, or mass operations require hierarchical breakdown"
   ```

3. **Don't forget adaptive brevity rules**
   - delegateBack: 10-20 words
   - approve responses: 40-100+ words (be detailed!)

4. **Don't allow robotic language**
   ```diff
   - "Executing calendar.read_email tool with parameters..."
   + "Смотрю последнее письмо"
   ```

---

## Updating the Prompt

### When to Update

- ✅ Adding new tool capabilities (new MCP servers)
- ✅ Changing complexity thresholds (simple/medium/complex definitions)
- ✅ Adjusting response length guidelines
- ✅ Adding new decision types (currently 4: approve/modify/reject/delegateBack)

### Update Checklist

1. [ ] Update instructions text in [agent.ts:35-551](../../../src/app/api/supervisor/agent.ts)
2. [ ] Update examples to match new behavior
3. [ ] Test with IntelligentSupervisor methods:
   - [ ] assessComplexity()
   - [ ] executeDirectly()
   - [ ] executeFlatWorkflow()
   - [ ] generatePlan()
4. [ ] Update this documentation (SUPERVISOR_PROMPT_GUIDE.md)
5. [ ] Update version number in prompt header

---

## Related Documentation

- [README.md](./README.md) — IntelligentSupervisor overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture
- [TASK_ORCHESTRATOR_INTEGRATION.md](./TASK_ORCHESTRATOR_INTEGRATION.md) — Hierarchical execution
- [agent.ts](../../../src/app/api/supervisor/agent.ts) — Full prompt source code

---

**📝 supervisorAgentInstructions — центральный промпт, определяющий поведение SupervisorAgent (GPT-4o) в 7 различных контекстах IntelligentSupervisor.**
