# Documentation Index

Полный индекс всей документации в проекте OpenAI Realtime Agents.

**Создано:** 2025-10-22
**Версия:** 1.0

---

## 📍 Навигация

### Корневая документация
- [📖 Main README](../README.md) — Getting started с проектом
- [🎯 CLAUDE.md](../CLAUDE.md) — Project overview, architecture, development guide
- [📚 docs/README.md](./README.md) — Главный индекс документации

---

## 🤖 Agents Documentation

### Обзор
- [Agents Overview](./agents/README.md) — Все агенты в проекте

### Realtime Agent Prompts
**Расположение:** [`docs/agents/realtime/prompts/`](./agents/realtime/prompts/)

| Документ | Кому | Что | Время |
|----------|------|-----|-------|
| [README.md](./agents/realtime/prompts/README.md) | All | Навигация и быстрый старт | 2 мин |
| [EXECUTIVE_SUMMARY.md](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) | PMs, leads | Краткие выводы анализа | 5 мин |
| [PROMPT_ANALYSIS.md](./agents/realtime/prompts/PROMPT_ANALYSIS.md) | Engineers | Детальный анализ 10 проблем | 30 мин |
| [PROMPT_COMPARISON.md](./agents/realtime/prompts/PROMPT_COMPARISON.md) | Engineers | Side-by-side v1.0 vs v2.0 | 15 мин |
| [QUICK_REFERENCE.md](./agents/realtime/prompts/QUICK_REFERENCE.md) | All engineers | Шпаргалка best practices | 5 мин |
| [EMAIL_READING_VERIFICATION.md](./agents/realtime/prompts/EMAIL_READING_VERIFICATION.md) | QA, engineers | Верификация чтения почты | 5 мин |
| [DEPLOYMENT.md](./agents/realtime/prompts/DEPLOYMENT.md) | DevOps, leads | Deployment guide v2.0 | 10 мин |

**Итого:** 7 документов, ~72 минут total reading time

---

## 🏗️ Architecture & Refactoring

| Документ | Язык | Что | Время |
|----------|------|-----|-------|
| [SUPERVISED-AGENT-REFACTORING.md](./SUPERVISED-AGENT-REFACTORING.md) | EN | Refactoring supervisor pattern | 20 мин |
| [SUPERVISED-AGENT-REFACTORING.ru.md](./SUPERVISED-AGENT-REFACTORING.ru.md) | RU | Refactoring supervisor pattern | 20 мин |

---

## 📂 Структура документации

```
docs/
├── README.md                                    # Main documentation index
├── DOCUMENTATION_INDEX.md                       # This file — full index
├── SUPERVISED-AGENT-REFACTORING.md              # Supervisor refactoring (EN)
├── SUPERVISED-AGENT-REFACTORING.ru.md           # Supervisor refactoring (RU)
└── agents/
    ├── README.md                                # Agents overview
    └── realtime/
        └── prompts/                             # RealtimeAgent prompts documentation
            ├── README.md                        # Navigation & quick start
            ├── EXECUTIVE_SUMMARY.md             # Key findings (5 min read)
            ├── PROMPT_ANALYSIS.md               # Detailed analysis (30 min)
            ├── PROMPT_COMPARISON.md             # v1.0 vs v2.0 (15 min)
            ├── QUICK_REFERENCE.md               # Best practices cheat sheet
            ├── EMAIL_READING_VERIFICATION.md    # Email reading verification
            └── DEPLOYMENT.md                    # Deployment guide v2.0
```

**Всего документов:** 11 (3 корневых + 2 agents + 7 prompts - 1 этот индекс)

---

## 🎯 Рекомендуемые reading paths

### Для Product Managers / Team Leads
1. [CLAUDE.md](../CLAUDE.md) — понять архитектуру проекта (10 мин)
2. [Agents Overview](./agents/README.md) — обзор агентов (5 мин)
3. [Executive Summary](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) — ключевые выводы промпт-анализа (5 мин)

**Total:** 20 минут

---

### Для Engineers (новички в проекте)
1. [README.md](../README.md) — getting started (5 мин)
2. [CLAUDE.md](../CLAUDE.md) — architecture & development guide (15 мин)
3. [Quick Reference](./agents/realtime/prompts/QUICK_REFERENCE.md) — best practices для промптов (5 мин)

**Total:** 25 минут

---

### Для Engineers (работа с промптами)
1. [Quick Reference](./agents/realtime/prompts/QUICK_REFERENCE.md) — шпаргалка (5 мин)
2. [Executive Summary](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) — пример анализа (5 мин)
3. [Prompt Analysis](./agents/realtime/prompts/PROMPT_ANALYSIS.md) — детальная методология (30 мин)

**Total:** 40 минут

---

### Для DevOps / Deployment
1. [Deployment Guide](./agents/realtime/prompts/DEPLOYMENT.md) — как deployed v2.0 (10 мин)
2. [Executive Summary](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) — что изменилось (5 мин)

**Total:** 15 минут

---

### Для Prompt Engineers / AI Specialists
**Полный deep dive:**
1. [README Prompts](./agents/realtime/prompts/README.md) — navigation (2 мин)
2. [Executive Summary](./agents/realtime/prompts/EXECUTIVE_SUMMARY.md) — выводы (5 мин)
3. [Prompt Analysis](./agents/realtime/prompts/PROMPT_ANALYSIS.md) — детальный анализ (30 мин)
4. [Prompt Comparison](./agents/realtime/prompts/PROMPT_COMPARISON.md) — v1 vs v2 (15 мин)
5. [Quick Reference](./agents/realtime/prompts/QUICK_REFERENCE.md) — best practices (5 мин)
6. [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide) — первоисточник (60 мин)

**Total:** ~120 минут

---

## 🔗 External Resources

### OpenAI
- [Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide) ⭐
- [Agents SDK](https://github.com/openai/openai-agents-sdk)
- [Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)

### Best Practices
- [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Voice Agent Best Practices](https://cookbook.openai.com/examples/realtime_prompting_guide#voice-tone-guidance)

---

## 📊 Documentation Stats

| Категория | Файлов | Примерное время чтения |
|-----------|--------|------------------------|
| Root (README, CLAUDE) | 2 | 15 мин |
| Agents overview | 2 | 7 мин |
| Realtime prompts | 7 | 72 мин |
| Architecture/refactoring | 2 | 40 мин (20 мин каждый) |
| **TOTAL** | **13** | **~134 мин (~2.2 часа)** |

---

## 🆕 Recent Updates

### 2025-10-22
- ✅ Создана структура `docs/agents/realtime/prompts/`
- ✅ Перенесено 7 документов по промптам из `src/app/agentConfigs/severstalAssistantAgent/`
- ✅ Создан главный индекс `docs/README.md`
- ✅ Создан overview `docs/agents/README.md`
- ✅ Обновлены все cross-references между документами
- ✅ Создан этот индексный файл

---

## 🤝 Contributing to Documentation

При добавлении новой документации:

1. **Выберите правильную категорию:**
   - Project-wide → `docs/`
   - Agent-specific → `docs/agents/[agent-type]/`
   - Feature-specific → создайте подпапку

2. **Naming conventions:**
   - Index files: `README.md`
   - Overview files: `SCREAMING_SNAKE_CASE.md`
   - Language variants: `.ru.md`, `.en.md` suffix

3. **Обязательные секции:**
   - Дата создания/обновления
   - Краткое описание (что/для кого/зачем)
   - Навигация (links to related docs)

4. **После добавления:**
   - Обновите этот индекс (`DOCUMENTATION_INDEX.md`)
   - Обновите `docs/README.md`
   - Обновите соответствующий README в категории

---

## 📞 Support

**Вопросы по документации:**
- Create issue в repo
- Пинг в team chat

**Предложения по улучшению:**
- Open PR с изменениями в `docs/`
- Discuss в issue перед major restructuring

---

**Последнее обновление:** 2025-10-22
**Maintainer:** AI Team
