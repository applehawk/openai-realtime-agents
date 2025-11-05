# Quick Reference: Best Practices для Realtime Agent Prompts

Краткая шпаргалка на основе [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide)

---

## ✅ DO

### Структура

- ✅ **Используй bullets вместо параграфов** — модель лучше понимает списки
- ✅ **Labeled sections** — четкие заголовки (Role, Tools, Instructions, etc.)
- ✅ **Explicit rules** — "Use ONLY when", "Do NOT use when", "ALWAYS", "NEVER"
- ✅ **Examples** — показывай желаемое поведение через примеры

### Tool Calling

- ✅ **Preambles** — короткие фразы (2-4 слова) перед каждым tool call
- ✅ **Per-tool confirmation rules** — четко определи, что требует подтверждения
- ✅ **"Use when" / "Do NOT use when"** — explicit границы для каждого tool
- ✅ **Escalation triggers** — когда делегировать/retry/inform user (numeric thresholds)

### Voice & Tone

- ✅ **Sample phrases** — greetings, acknowledgments, closers с вариациями
- ✅ **"DO NOT ALWAYS USE THESE"** — предотвращай роботизацию
- ✅ **Adaptive brevity** — разные limits для разных типов ответов
- ✅ **Pronunciation guides** — фонетика для акронимов и технических терминов

### Error Handling

- ✅ **Progressive escalation** — 1st failure: retry, 2nd: delegate, 3rd: inform
- ✅ **User-friendly errors** — переводи technical errors в conversational Russian
- ✅ **Recovery strategies** — альтернативные подходы при failures

---

## ❌ DON'T

### Структура

- ❌ **Dense paragraphs** — модель может пропускать детали
- ❌ **Ambiguous instructions** — "try to be helpful" слишком vague
- ❌ **Conflicting rules** — "be brief" vs "provide detailed summaries"
- ❌ **Unstated assumptions** — не предполагай, что модель "знает"

### Tool Calling

- ❌ **No preambles** — создает awkward паузы
- ❌ **Generic confirmation** — "confirm important actions" слишком vague
- ❌ **Missing "Do NOT use when"** — модель может использовать tool неправильно
- ❌ **No escalation logic** — infinite retry loops при failures

### Voice & Tone

- ❌ **No sample phrases** — риск роботизированных ответов
- ❌ **Rigid brevity** — "always 5-20 words" не подходит для всех ситуаций
- ❌ **No pronunciation guides** — непредсказуемое произношение
- ❌ **No variety reminders** — модель может повторять одни и те же фразы

### Error Handling

- ❌ **No retry strategy** — модель не знает, когда retry vs escalate
- ❌ **Exposing technical errors** — "Error 500" вместо "Произошла ошибка"
- ❌ **No alternatives** — модель сдается без предложения других подходов

---

## Шаблон промпта

```
## Role & Objective
[Кто агент, что должен делать, success criteria]

## Personality & Tone
- Character traits
- Response length (adaptive)
- Pacing guidelines
- Sample phrases with variety

## Reference Pronunciations
- Technical terms: [phonetic guides]
- Dates/times: [format guidelines]
- Special characters: [how to read]

## Language Control
- Target language pinning
- Handling other languages
- Unclear audio handling

## Tools Overview
[Brief description of available tools]

## Tool Selection Matrix

### Tool 1
**Use ONLY when:**
- ✅ [Criteria 1]
- ✅ [Criteria 2]

**Do NOT use when:**
- ❌ [Anti-criteria 1]
- ❌ [Anti-criteria 2]

### Tool 2
[Same structure]

## Tool Call Behavior

### Preambles
- Before Tool 1: [2-4 word phrases]
- Before Tool 2: [2-4 word phrases]

### Confirmation Rules
| Tool/Action | Confirm? | When |
|-------------|----------|------|
| Action 1    | ✅ YES   | Always |
| Action 2    | ❌ NO    | Never |

## Conversation Flow
- Greetings: [sample phrases]
- Acknowledgments: [sample phrases]
- Clarifications: [sample phrases]
- Bridges: [sample phrases]
- Closers: [sample phrases]

**DO NOT ALWAYS USE THESE. VARY YOUR RESPONSES.**

## State Management
- After delegation: [behavior]
- Switching tools: [behavior]
- Context preservation: [rules]

## Escalation & Error Handling

### Triggers
- After N failures: [action]
- When uncertain: [action]
- Out of scope: [action]

### Recovery
- 1st failure: [strategy]
- 2nd failure: [strategy]
- 3rd failure: [strategy]

## Edge Cases
[Specific scenarios with solutions]

## Safety & Privacy
- Do NOT execute when: [criteria]
- Privacy guidelines: [rules]

## Final Reminders
[Top 5-10 most important rules in caps]
```

---

## Метрики качества промпта

Хороший промпт должен иметь:

- ✅ **Explicit rules** для 90%+ возможных ситуаций
- ✅ **"Use when" / "Do NOT use when"** для всех tools
- ✅ **Preambles** для всех типов tool calls
- ✅ **Per-action confirmation matrix**
- ✅ **Sample phrases** с reminder о вариативности
- ✅ **Numeric thresholds** для escalation/retry
- ✅ **Edge cases** с конкретными решениями
- ✅ **Pronunciation guides** для всех технических терминов
- ✅ **0 конфликтующих инструкций**

---

## Checklist перед deployment

- [ ] Role не ограничивает capabilities агента
- [ ] Все tools имеют "Use ONLY when" / "Do NOT use when"
- [ ] Все tools имеют preambles (2-4 слова)
- [ ] Все actions имеют explicit confirmation rules (YES/NO)
- [ ] Sample phrases для greetings, acknowledgments, closers
- [ ] Reminder "DO NOT ALWAYS USE THESE" для sample phrases
- [ ] Pronunciation guides для всех акронимов и терминов
- [ ] Adaptive brevity (не rigid "5-20 words")
- [ ] Escalation triggers с numeric thresholds (N failures)
- [ ] Error recovery strategy (1st/2nd/3rd failure)
- [ ] Edge cases с конкретными решениями
- [ ] State management rules (delegation, switching, context)
- [ ] 0 conflicting instructions
- [ ] Safety & privacy guidelines

---

## Частые ошибки

### 1. Rigid brevity
❌ "Maintain responses between 5-20 words"
✅ "Simple confirmations: 3-5 words; Summaries: 20-40 words"

### 2. Vague confirmation
❌ "Confirm important actions before execution"
✅ Per-action matrix: Send email=YES, Read email=NO

### 3. Missing preambles
❌ [Silent tool call]
✅ «Смотрю календарь» [then tool call]

### 4. No escalation logic
❌ "Handle errors gracefully"
✅ "1st failure: retry; 2nd: delegate; 3rd: inform user"

### 5. No "Do NOT use when"
❌ "Use Tool A for task X"
✅ "Use Tool A ONLY when [criteria]. Do NOT use when [anti-criteria]"

### 6. Conflicting instructions
❌ "Be brief (5-20 words)" + "Summarize findings conversationally"
✅ "Summaries: 20-40 words (can span 2-3 turns)"

### 7. Role ограничивает
❌ "You are a specialist in email management"
✅ "Primary expertise: email. Also capable of: [other tasks]"

### 8. No sample phrases
❌ "Be friendly and upbeat"
✅ Sample phrases + "DO NOT ALWAYS USE THESE"

### 9. Dense paragraphs
❌ [3-sentence paragraph with multiple rules]
✅ [Bullet list with one rule per bullet]

### 10. No pronunciation guides
❌ "MCP", "RAG" without phonetics
✅ "MCP → 'эм-си-пи' (spell out)"

---

## Итерация промпта

1. **Baseline**: Запиши текущие метрики (tool accuracy, task completion, satisfaction)
2. **Hypothesis**: Какая проблема? Какое изменение должно помочь?
3. **Change**: Сделай ОДНО изменение (не несколько сразу)
4. **Test**: A/B test минимум 50-100 sessions
5. **Measure**: Сравни метрики с baseline
6. **Iterate**: Keep change если улучшение 5%+, revert если нет

**Важно:** Minor wording adjustments могут значительно влиять на behavior.
Пример из OpenAI guide: "inaudible" → "unintelligible" улучшило noisy input handling.

---

## Ресурсы

- [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide) — полный гайд
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering) — общие принципы
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering) — best practices

---

**Последнее обновление:** 2025-10-22
