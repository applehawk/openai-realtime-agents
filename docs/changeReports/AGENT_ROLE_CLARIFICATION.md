# Agent Role Clarification: WorkflowOrchestrator vs Executor

**Date:** 2025-10-25  
**Type:** Architecture Clarification  
**Status:** ✅ Completed

## 🎯 Проблема

Были неясны границы между `WorkflowOrchestrator` и `Executor` агентами:
- Оба имеют одинаковые MCP tools
- Оба могут выполнять multi-step workflows
- Промпты частично дублировались
- Неочевидно, когда использовать какой агент

**Вопрос:** Может ли подзадача в иерархии попасть на WorkflowOrchestrator?

## ✅ Решение

Принято решение: **Вариант 3 - СОХРАНИТЬ разделение с ЧЕТКИМИ ролями**

### Новое разделение:

| Агент | Контекст | Уровень | Сложность |
|-------|----------|---------|-----------|
| **WorkflowOrchestrator** | ROOT LEVEL | Только корень | simple/medium |
| **Executor** | HIERARCHICAL | Любой (1-5) | Любая |

### Ключевое различие:

**WorkflowOrchestrator:**
- ✅ Используется на корневом уровне (прямой запрос пользователя)
- ✅ Работает БЕЗ контекста от других задач
- ✅ Самостоятельно планирует и выполняет workflows
- ❌ НЕ используется внутри иерархий

**Executor:**
- ✅ Используется ВНУТРИ иерархий (complex tasks)
- ✅ Работает С КОНТЕКСТОМ (subtaskResults, previousResults)
- ✅ Два режима: aggregation или leaf execution
- ✅ Может быть на любом уровне вложенности (1-5)
- ❌ НЕ используется на root level для simple/medium

### Ответ на вопрос:

**НЕТ**, подзадача (любого уровня) **НЕ МОЖЕТ** попасть на WorkflowOrchestrator.

Как только система выбирает `hierarchical` стратегию, **ВСЕ задачи** выполняются через `Executor`.

## 📝 Изменения в коде

### 1. Промпт WorkflowOrchestrator
**Файл:** `src/app/api/supervisor/prompts/workflowOrchestrator.ts`

Добавлено в начало промпта:
```markdown
# When You Are Called

✅ You handle SIMPLE and MEDIUM tasks at the root level:
- Direct user requests (no parent tasks)
- No context from other subtasks
- No aggregation needed - you do everything yourself

❌ You are NOT used for:
- Tasks inside hierarchies (ExecutorAgent handles those)
- Aggregating results from subtasks
- Tasks that already have context from sibling tasks
```

### 2. Промпт Executor
**Файл:** `src/app/api/supervisor/prompts/executor.ts`

Добавлено в начало промпта:
```markdown
# When You Are Called

✅ You handle tasks INSIDE hierarchies (COMPLEX root tasks):
- Tasks at any nesting level (1, 2, 3, etc.)
- Tasks with context from parent/sibling tasks
- Leaf tasks that need direct execution
- Parent tasks that need subtask aggregation

❌ You are NOT used for:
- Root-level simple/medium tasks (WorkflowOrchestratorAgent handles those)
- Tasks without any hierarchical context
```

Добавлена секция про multi-step capabilities:
```markdown
## Mode 2: Leaf Execution (NO subtaskResults)

**Multi-step capability:**
Unlike WorkflowOrchestrator (which plans complex workflows), you execute focused sequences:
- Read email → Extract data (2 steps)
- Check calendar → Create event (2 steps)  
- Search → Filter → Return (3 steps)

**You differ from WorkflowOrchestrator:**
- They: Root level, plan complex workflows (5+ steps), no context
- You: Inside hierarchy, focused execution (2-3 steps), rich context
```

### 3. IntelligentSupervisor комментарии
**Файл:** `src/app/api/supervisor/unified/intelligentSupervisor.ts`

Добавлены детальные комментарии в методы:

**executeDirectly():**
```typescript
/**
 * WHY WorkflowOrchestrator?
 * - ROOT LEVEL task (user's direct request)
 * - NO context from other tasks
 * - Simple task that doesn't need decomposition
 * - Agent plans and executes independently
 */
```

**executeFlatWorkflow():**
```typescript
/**
 * WHY WorkflowOrchestrator?
 * - ROOT LEVEL task (user's direct request)
 * - NO context from other tasks
 * - Medium complexity workflow (3-5 sequential steps)
 * - Agent plans multi-step workflow independently
 * - Handles conditional logic and data synthesis
 */
```

**executeSingleTaskWithAgent():**
```typescript
/**
 * WHY ExecutorAgent?
 * - INSIDE HIERARCHY (complex root task decomposed into subtasks)
 * - HAS CONTEXT from parent/sibling tasks (previousResults, subtaskResults)
 * - Either LEAF task execution OR AGGREGATION of subtask results
 * - Works at ANY nesting level (1, 2, 3, etc.)
 * - Uses accumulated context for better decisions
 * 
 * ExecutorAgent has TWO modes:
 * 1. Aggregation: if task.subtaskResults exists → synthesize results
 * 2. Leaf execution: if NO subtaskResults → execute task directly (can do 2-3 step workflows)
 */
```

### 4. Документация
**Файл:** `docs/currentImplementation/agents/supervised/EXECUTOR_VS_ORCHESTRATOR.md`

Создан подробный документ с:
- Сравнительной таблицей агентов
- Визуальными сценариями использования
- FAQ секцией
- Примерами кода
- Метриками использования

## 📊 Результаты

### Преимущества подхода:

✅ **Четкие границы** - теперь очевидно, когда использовать какой агент  
✅ **Специализация** - каждый агент оптимизирован под свой контекст  
✅ **Документирование** - код и промпты содержат явные объяснения  
✅ **Поддержка** - проще онбордить новых разработчиков  
✅ **Отладка** - легче понять, какой агент и почему сработал  

### Архитектурная схема:

```
IntelligentSupervisor (root)
│
├─ SIMPLE → WorkflowOrchestrator (root level, no context)
│
├─ MEDIUM → WorkflowOrchestrator (root level, no context)
│
└─ COMPLEX → TaskOrchestrator → Executor (any level, with context)
                    │
                    ├─ Level 1 → Executor
                    ├─ Level 2 → Executor
                    ├─ Level 3 → Executor
                    └─ Aggregation → Executor
```

## 🎓 Ключевые выводы

1. **Контекст - главное различие**: WorkflowOrchestrator работает без контекста, Executor - с контекстом
2. **Уровень применения**: WorkflowOrchestrator только root, Executor только hierarchy
3. **Нет пересечений**: Агенты не конкурируют, у каждого своя зона ответственности
4. **Дополнение, а не дублирование**: Оба нужны для полного покрытия сценариев

## 📚 Связанные документы

- `docs/currentImplementation/agents/supervised/EXECUTOR_VS_ORCHESTRATOR.md` - полное описание
- `src/app/api/supervisor/prompts/workflowOrchestrator.ts` - обновленный промпт
- `src/app/api/supervisor/prompts/executor.ts` - обновленный промпт
- `src/app/api/supervisor/unified/intelligentSupervisor.ts` - обновленные комментарии

---

**Автор:** AI Assistant  
**Reviewers:** TBD  
**Next Steps:** Testing в production для валидации разделения ролей

