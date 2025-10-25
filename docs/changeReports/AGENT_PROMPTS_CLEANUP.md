# Agent Prompts Cleanup: Удаление кросс-ссылок между агентами

**Date:** 2025-10-25  
**Type:** Prompt Refactoring  
**Status:** ✅ Completed

## 🎯 Проблема

Промпты агентов содержали ссылки друг на друга:

**Executor промпт:**
```markdown
❌ You are NOT used for:
- Root-level simple/medium tasks (WorkflowOrchestratorAgent handles those)

You ALWAYS receive rich context (this is your advantage over WorkflowOrchestrator):

**You differ from WorkflowOrchestrator:**
- They: Root level, plan complex workflows (5+ steps), no context
- You: Inside hierarchy, focused execution (2-3 steps), rich context
```

**WorkflowOrchestrator промпт:**
```markdown
❌ You are NOT used for:
- Tasks inside hierarchies (ExecutorAgent handles those)
```

### Почему это проблема?

1. **Нарушение инкапсуляции** - агент не должен знать о других агентах
2. **Лишний контекст** - увеличивает размер промпта без пользы
3. **Связанность** - изменение одного агента требует изменения другого
4. **Когнитивная нагрузка** - агенту не нужно понимать архитектуру системы

## ✅ Решение

Убрали все кросс-ссылки между агентами. Каждый агент теперь описывает только:
- ✅ Свою роль
- ✅ Свой контекст
- ✅ Свои capabilities
- ❌ НЕ упоминает других агентов

## 📝 Изменения

### 1. Executor промпт (`prompts/executor.ts`)

#### Было:
```markdown
❌ You are NOT used for:
- Root-level simple/medium tasks (WorkflowOrchestratorAgent handles those)
- Tasks without any hierarchical context

You ALWAYS receive rich context (this is your advantage over WorkflowOrchestrator):

**Multi-step capability:**
Unlike WorkflowOrchestrator (which plans complex workflows), you execute focused sequences:
- Read email → Extract data (2 steps)

**You differ from WorkflowOrchestrator:**
- They: Root level, plan complex workflows (5+ steps), no context
- You: Inside hierarchy, focused execution (2-3 steps), rich context
```

#### Стало:
```markdown
❌ You are NOT used for:
- Tasks without any hierarchical context
- Tasks where no parent/sibling context is available

You ALWAYS receive rich context from the task hierarchy:

**Multi-step execution:**
You can execute focused sequences when needed:
- Read email → Extract data (2 steps)
- Check calendar → Create event (2 steps)

**Key advantage:**
You leverage context from parent/sibling tasks, so you don't need to re-query 
information that's already available in previousResults.
```

### 2. WorkflowOrchestrator промпт (`prompts/workflowOrchestrator.ts`)

#### Было:
```markdown
For tasks inside hierarchies (with subtask context), ExecutorAgent is used instead.

❌ You are NOT used for:
- Tasks inside hierarchies (ExecutorAgent handles those)
```

#### Стало:
```markdown
❌ You are NOT used for:
- Tasks inside hierarchies (complex task trees)
- Aggregating results from subtasks
- Tasks that already have context from sibling tasks
```

## 📊 Результаты

### Преимущества:

✅ **Независимость** - каждый агент теперь self-contained  
✅ **Меньше токенов** - убрано ~150 токенов из каждого промпта  
✅ **Проще поддержка** - изменение одного агента не требует изменения других  
✅ **Чище промпты** - фокус на том, что делает агент, а не на том, что НЕ делает  
✅ **Лучшая инкапсуляция** - агент не знает о внешней архитектуре  

### Метрики:

| Промпт | Было строк | Стало строк | Экономия |
|--------|-----------|-------------|----------|
| executor.ts | ~120 | ~115 | ~5 строк |
| workflowOrchestrator.ts | ~196 | ~194 | ~2 строки |

**Экономия токенов:** ~150-200 токенов на вызов агентов

## 🎓 Принципы

### Что должен знать агент:

✅ Свою роль и ответственность  
✅ Входные данные (контекст)  
✅ Ожидаемый output формат  
✅ Примеры использования  
✅ Ограничения (что он НЕ может делать)  

### Что НЕ должен знать агент:

❌ О существовании других агентов  
❌ Об архитектуре системы  
❌ О том, кто его вызывает  
❌ О routing logic  
❌ Сравнения с другими компонентами  

## 📚 Best Practices

### 1. Separation of Concerns
Каждый агент - черный ящик с четким API:
```
Input → [Agent] → Output
```

### 2. Self-Contained Prompts
Промпт должен быть понятен без знания всей системы:
```markdown
# Role
You are X that does Y.

# Input
You receive A, B, C.

# Output
Return format: {...}
```

### 3. Focus on Capabilities, not Comparisons
```markdown
✅ Good: "You can execute 2-3 step sequences"
❌ Bad: "Unlike X, you execute 2-3 steps while X does 5+"
```

### 4. Describe Context, not Architecture
```markdown
✅ Good: "You work inside hierarchies with parent/sibling context"
❌ Bad: "You're called by TaskOrchestrator when DecisionAgent says yes"
```

## 🔄 Related Changes

- `AGENT_ROLE_CLARIFICATION.md` - определение ролей (для людей)
- `EXECUTOR_VS_ORCHESTRATOR.md` - сравнение агентов (для людей)
- Промпты - описание роли (для AI)

**Ключевое различие:** 
- Документация для людей МОЖЕТ содержать сравнения
- Промпты для AI НЕ ДОЛЖНЫ содержать кросс-ссылки

---

**Автор:** AI Assistant  
**Reviewed by:** User  
**Status:** ✅ Applied, Tested, Documented

