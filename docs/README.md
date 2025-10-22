# OpenAI Realtime Agents — Documentation

Документация для проекта демонстрации advanced voice agent patterns с OpenAI Realtime API.

**Последнее обновление:** 2025-10-22

**📋 Полный индекс:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) — все документы с reading paths

---

## 📚 Документация

### Agents
- [**Agents Documentation**](./agents/README.md) — документация по всем агентам
  - [Realtime Agent Prompts](./agents/realtime/prompts/README.md) — анализ и best practices для промптов

### Architecture & Refactoring
- [SUPERVISED-AGENT-REFACTORING.md](./SUPERVISED-AGENT-REFACTORING.md) — Refactoring supervisor agent (EN)
- [SUPERVISED-AGENT-REFACTORING.ru.md](./SUPERVISED-AGENT-REFACTORING.ru.md) — Refactoring supervisor agent (RU)

---

## 🚀 Быстрый старт

### Если вы работаете с промптами для RealtimeAgent:

**Шпаргалка (5 минут):**
→ [Quick Reference: Best Practices](./agents/realtime/prompts/QUICK_REFERENCE.md)

**Пример улучшения промпта:**
→ [Executive Summary](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) — как улучшить промпт на основе best practices

**Детальный анализ:**
→ [Prompt Analysis](./agents/realtime/prompts/PROMPT_ANALYSIS.md) — разбор 10 критических проблем

---

### Если вы добавляете нового агента:

1. Создайте файл агента в `src/app/agentConfigs/yourAgent/`
2. Следуйте структуре из [CLAUDE.md](../CLAUDE.md#adding-a-new-agent-scenario)
3. Используйте checklist из [Quick Reference](./agents/realtime/prompts/QUICK_REFERENCE.md)
4. Задокументируйте промпт и design decisions

---

### Если вы рефакторите supervisor pattern:

→ [Supervised Agent Refactoring](./SUPERVISED-AGENT-REFACTORING.md) — детальный гайд

---

## 📖 Структура документации

```
docs/
├── README.md                                 # Этот файл — навигация
├── SUPERVISED-AGENT-REFACTORING.md           # Refactoring supervisor (EN)
├── SUPERVISED-AGENT-REFACTORING.ru.md        # Refactoring supervisor (RU)
└── agents/
    ├── README.md                             # Обзор всех агентов
    └── realtime/
        └── prompts/                          # Документация по промптам
            ├── README.md                     # Навигация
            ├── EXECUTIVE_SUMMARY.md          # Краткие выводы
            ├── PROMPT_ANALYSIS.md            # Детальный анализ
            ├── PROMPT_COMPARISON.md          # v1.0 vs v2.0
            ├── QUICK_REFERENCE.md            # Шпаргалка best practices
            ├── EMAIL_READING_VERIFICATION.md # Feature verification
            └── DEPLOYMENT.md                 # Deployment guide
```

---

## 🎯 Ключевые ресурсы

### Внешние
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide) ⭐
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-sdk)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)

### Внутренние
- [CLAUDE.md](../CLAUDE.md) — Project overview и architecture
- [README.md](../README.md) — Getting started

---

## 📊 Метрики и Best Practices

### Realtime Agent Prompts

**Текущий статус `severstalAssistant`:**
- ✅ Prompt v2.0 deployed (2025-10-22)
- ✅ 90%+ соответствие best practices
- ✅ Улучшения: +20% tool accuracy, +12% task completion (target)

**Best Practices:**
1. Bullets over paragraphs
2. Explicit "Use ONLY when" / "Do NOT use when" rules
3. Preambles before all tool calls (2-4 words)
4. Sample phrases with variety reminders
5. Per-tool confirmation matrix
6. Escalation triggers (numeric thresholds)
7. Adaptive brevity constraints
8. Pronunciation guides for voice
9. State management rules
10. Zero conflicting instructions

**Подробнее:** [Quick Reference](./agents/realtime/prompts/QUICK_REFERENCE.md)

---

## 🤝 Contributing

При добавлении или улучшении документации:

1. **Структура:** Следуйте существующей иерархии `docs/`
2. **Naming:** Используйте SCREAMING_SNAKE_CASE для MD файлов (кроме README.md)
3. **Format:** Используйте markdown с четкими заголовками и navigation
4. **Cross-linking:** Добавляйте ссылки на related документы
5. **Update index:** Обновите этот README.md при добавлении новых разделов

---

## 📝 Changelog

### 2025-10-22
- ✅ Создана структура `docs/agents/realtime/prompts/`
- ✅ Добавлена документация по улучшению промптов (7 документов)
- ✅ Добавлен Quick Reference для best practices
- ✅ Задокументирован deployment v2.0 для `severstalAssistant`

### Earlier
- SUPERVISED-AGENT-REFACTORING.md — refactoring supervisor pattern
- SUPERVISED-AGENT-REFACTORING.ru.md — Russian version

---

**Навигация:**
- [← Back to Project Root](../README.md)
- [Agents Documentation →](./agents/README.md)
- [Realtime Prompts →](./agents/realtime/prompts/README.md)
