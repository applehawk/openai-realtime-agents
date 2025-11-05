# Agents Documentation

Документация для всех агентов в проекте OpenAI Realtime Agents.

---

## Структура

```
docs/agents/
├── README.md (этот файл)
└── realtime/
    └── prompts/          # Документация по промптам для RealtimeAgent
        ├── README.md                         # Навигация и быстрый старт
        ├── EXECUTIVE_SUMMARY.md              # Краткие выводы анализа
        ├── PROMPT_ANALYSIS.md                # Детальный анализ промпта v1.0
        ├── PROMPT_COMPARISON.md              # Сравнение v1.0 vs v2.0
        ├── QUICK_REFERENCE.md                # Шпаргалка best practices
        ├── EMAIL_READING_VERIFICATION.md     # Верификация чтения почты
        └── DEPLOYMENT.md                     # Deployment guide v2.0
```

---

## Agents

### 1. Realtime Agents

**Расположение:** `src/app/agentConfigs/`

**Типы:**
- `severstalAssistant` — Русскоязычный голосовой ассистент для email/calendar + RAG
- `chatSupervisor` — Chat agent с supervisor delegation
- `customerServiceRetail` — Multi-agent customer service flow
- `simpleHandoff` — Basic agent handoff example

**Документация:**
- [Realtime Agent Prompts](./realtime/prompts/README.md) — Анализ и best practices для промптов

---

## Быстрый старт

### Если вы хотите улучшить промпт для RealtimeAgent:

1. Прочитайте [QUICK_REFERENCE.md](./realtime/prompts/QUICK_REFERENCE.md) — шпаргалка best practices (5 мин)
2. Изучите [EXECUTIVE_SUMMARY.md](./realtime/prompts/EXECUTIVE_SUMMARY.md) — ключевые находки (5 мин)
3. Используйте checklist из QUICK_REFERENCE перед deployment

### Если вы хотите понять, как был улучшен `severstalAssistant`:

1. [EXECUTIVE_SUMMARY.md](./realtime/prompts/EXECUTIVE_SUMMARY.md) — краткие выводы (5 мин)
2. [PROMPT_COMPARISON.md](./realtime/prompts/PROMPT_COMPARISON.md) — side-by-side сравнение (15 мин)
3. [DEPLOYMENT.md](./realtime/prompts/DEPLOYMENT.md) — что изменилось в коде (10 мин)

### Если вы хотите глубоко разобраться в методологии:

1. [README.md](./realtime/prompts/README.md) — навигация по всем документам
2. [PROMPT_ANALYSIS.md](./realtime/prompts/PROMPT_ANALYSIS.md) — детальный анализ (30 мин)
3. [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide) — первоисточник

---

## Методология

Все анализы промптов в этой документации основаны на:
- [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)

**Ключевые принципы:**
1. ✅ Bullets over paragraphs
2. ✅ Explicit rules ("Use ONLY when", "Do NOT use when")
3. ✅ Sample phrases with variety reminders
4. ✅ Preambles before tool calls
5. ✅ Per-tool confirmation rules
6. ✅ Escalation triggers with numeric thresholds
7. ✅ Pronunciation guides for voice agents
8. ✅ Adaptive brevity constraints
9. ✅ State management rules
10. ✅ Zero conflicting instructions

---

## Contributing

При добавлении новых агентов или улучшении промптов:

1. **Follow best practices** из [QUICK_REFERENCE.md](./realtime/prompts/QUICK_REFERENCE.md)
2. **Document changes** в формате DEPLOYMENT.md
3. **Run analysis** для major changes (используйте чеклист)
4. **A/B test** перед full rollout (если возможно)
5. **Iterate** на основе метрик и conversation logs

---

## Полезные ссылки

### Внешние ресурсы
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-sdk)
- [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide)
- [Voice Agent Best Practices](https://cookbook.openai.com/examples/realtime_prompting_guide#voice-tone-guidance)

### Внутренние ресурсы
- [CLAUDE.md](../../CLAUDE.md) — Project overview и architecture
- [Realtime Prompts Documentation](./realtime/prompts/README.md)

---

**Последнее обновление:** 2025-10-22
