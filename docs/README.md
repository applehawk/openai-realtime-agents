# OpenAI Realtime Agents — Documentation

Документация для проекта демонстрации advanced voice agent patterns с OpenAI Realtime API.

**Последнее обновление:** 2025-10-24

**📋 Полный индекс:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) — все документы с reading paths

---

## 📚 Структура документации

### 📖 Текущая реализация
**[currentImplementation/](./currentImplementation/)** — актуальная документация по архитектуре и агентам

- [**Architecture**](./currentImplementation/ARCHITECTURE.md) — общая архитектура проекта
- [**Testing Guide**](./currentImplementation/TESTING_GUIDE.md) — руководство по тестированию
- [**Agents Documentation**](./currentImplementation/agents/README.md) — документация по всем агентам
  - [Realtime Agent Prompts](./currentImplementation/agents/realtime/prompts/README.md) — best practices для промптов
  - [Supervised Agents](./currentImplementation/agents/supervised/README.md) — документация по supervised агентам
- [**Severstal Assistant**](./currentImplementation/severstal-assistant-agent-prompt-documentation.md) — документация основного агента
- [**MCP Integration**](./currentImplementation/mcp/) — интеграция с Model Context Protocol
- [**Intelligent Supervisor**](./currentImplementation/intelligentSupervisorAgent/) — унифицированная система делегирования задач
  - [README](./currentImplementation/intelligentSupervisorAgent/README.md) — обзор и интеграция
  - [Architecture](./currentImplementation/intelligentSupervisorAgent/ARCHITECTURE.md) — диаграммы и data flow
  - [Supervisor Prompt Guide](./currentImplementation/intelligentSupervisorAgent/SUPERVISOR_PROMPT_GUIDE.md) — промпт-инженеринг
  - [Task Orchestrator Integration](./currentImplementation/intelligentSupervisorAgent/TASK_ORCHESTRATOR_INTEGRATION.md) — иерархическая система
  - [Progress Tracking](./currentImplementation/intelligentSupervisorAgent/PROGRESS_TRACKING.md) — SSE прогресс-трекинг
  - [Agent Architecture Decision](./currentImplementation/intelligentSupervisorAgent/AGENT_ARCHITECTURE_DECISION.md) — почему один агент, а не 7

### 📊 Отчеты об изменениях
**[changeReports/](./changeReports/)** — история завершенных изменений и миграций

- [**Phase 1 Completed**](./changeReports/PHASE1_COMPLETED.md) — отчет о завершении Phase 1
- [**Phase 2 Summary**](./changeReports/PHASE2_SUMMARY.md) — краткий отчет Phase 2
- [**Phase 2 Completed**](./changeReports/PHASE2_COMPLETED.md) — полный отчет Phase 2
- [**Phase 2 Implementation**](./changeReports/PHASE2_IMPLEMENTATION_REPORT.md) — детали реализации
- [**UI Integration**](./changeReports/UI_INTEGRATION_COMPLETED.md) — интеграция UI компонентов
- [**Cleanup Summary**](./changeReports/CLEANUP_FINAL_SUMMARY.md) — отчет о рефакторинге
- [**Final Summary**](./changeReports/FINAL_SUMMARY.md) — итоговый отчет проекта

### 🎯 Планируемые изменения
**[plannedChanges/](./plannedChanges/)** — документация по планируемым и предложенным изменениям

- [**Delegation Analysis**](./plannedChanges/DELEGATION_ANALYSIS.md) — анализ паттернов делегирования
- [**Delegation Flow Diagram**](./plannedChanges/DELEGATION_FLOW_DIAGRAM.md) — диаграммы потоков делегирования
- [**Agent Decomposition**](./plannedChanges/agent-decomposition-final.md) — финальный план декомпозиции агентов
- [**Suggested Changes**](./plannedChanges/suggested-changes/) — предложенные изменения

### 🗄️ Устаревшая документация
**[legacy/](./legacy/)** — устаревшая документация для справки

- [**Legacy Tools Removal**](./legacy/LEGACY_TOOLS_REMOVAL.md) — удаление устаревших инструментов
- [**Supervised Agent Refactoring**](./legacy/SUPERVISED-AGENT-REFACTORING.md) — старый подход к рефакторингу
- [**Phase 2 Debug Instructions**](./legacy/PHASE2_DEBUG_INSTRUCTIONS.md) — устаревшие инструкции отладки

---

## 🚀 Быстрый старт

### Если вы новичок в проекте:

1. [**Project Overview**](../CLAUDE.md) — общее понимание архитектуры (10 мин)
2. [**Architecture**](./currentImplementation/ARCHITECTURE.md) — детальная архитектура (15 мин)
3. [**Agents Overview**](./currentImplementation/agents/README.md) — обзор агентов (5 мин)

### Если вы работаете с промптами для RealtimeAgent:

**Шпаргалка (5 минут):**
→ [Quick Reference: Best Practices](./currentImplementation/agents/realtime/prompts/QUICK_REFERENCE.md)

**Пример улучшения промпта:**
→ [Executive Summary](./currentImplementation/agents/realtime/prompts/EXECUTIVE_SUMMARY.md)

**Детальный анализ:**
→ [Prompt Analysis](./currentImplementation/agents/realtime/prompts/PROMPT_ANALYSIS.md)

### Если вы добавляете нового агента:

1. Создайте файл агента в `src/app/agentConfigs/yourAgent/`
2. Следуйте структуре из [CLAUDE.md](../CLAUDE.md#adding-a-new-agent-scenario)
3. Используйте checklist из [Quick Reference](./currentImplementation/agents/realtime/prompts/QUICK_REFERENCE.md)
4. Задокументируйте промпт и design decisions

### Если вы хотите понять историю изменений:

→ [Change Reports](./changeReports/) — все завершенные изменения и миграции

---

## 📖 Полная структура документации

```
docs/
├── README.md                           # Этот файл — навигация
├── DOCUMENTATION_INDEX.md              # Детальный индекс всех документов
│
├── currentImplementation/              # 📖 Текущая реализация
│   ├── ARCHITECTURE.md
│   ├── TESTING_GUIDE.md
│   ├── severstal-assistant-agent-prompt-documentation.md
│   ├── agents/                        # Документация по агентам
│   │   ├── README.md
│   │   ├── supervised/                # Supervised agents
│   │   └── realtime/prompts/          # Realtime agent prompts
│   ├── mcp/                           # MCP integration
│   └── intelligentSupervisorAgent/    # Intelligent supervisor
│
├── changeReports/                      # 📊 Отчеты об изменениях
│   ├── PHASE1_COMPLETED.md
│   ├── PHASE2_*.md                    # Phase 2 отчеты
│   ├── UI_INTEGRATION_COMPLETED.md
│   ├── CLEANUP_FINAL_SUMMARY.md
│   └── FINAL_SUMMARY.md
│
├── plannedChanges/                     # 🎯 Планируемые изменения
│   ├── DELEGATION_*.md                # Delegation паттерны
│   ├── agent-decomposition-*.md       # Agent decomposition
│   └── suggested-changes/             # Предложенные изменения
│
└── legacy/                             # 🗄️ Устаревшая документация
    ├── SUPERVISED-AGENT-REFACTORING.md
    ├── LEGACY_TOOLS_REMOVAL.md
    └── delegation/                     # Старая документация delegation
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

**Подробнее:** [Quick Reference](./currentImplementation/agents/realtime/prompts/QUICK_REFERENCE.md)

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

### 2025-10-24
- ✅ Реорганизация документации по категориям
- ✅ Создана структура `currentImplementation/`, `changeReports/`, `plannedChanges/`, `legacy/`
- ✅ Перемещены все файлы в соответствующие категории
- ✅ Обновлен README.md с новой структурой навигации

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
- [Current Implementation →](./currentImplementation/)
- [Change Reports →](./changeReports/)
- [Planned Changes →](./plannedChanges/)
- [Legacy Documentation →](./legacy/)
