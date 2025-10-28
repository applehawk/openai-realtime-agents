# WorkflowOrchestrator vs Executor: Разделение ролей

> Документ объясняет четкое разделение ответственности между двумя агентами выполнения

## 🎯 Краткая суть

| Агент | Контекст | Уровень | Сложность | Особенности |
|-------|----------|---------|-----------|-------------|
| **WorkflowOrchestrator** | ROOT LEVEL | Корень | simple/medium | Работает БЕЗ контекста, планирует самостоятельно |
| **Executor** | HIERARCHICAL | Любой (1-5) | любая | Работает С контекстом, агрегирует или исполняет |

---

## 📋 WorkflowOrchestrator

### Когда используется?

✅ **ДА** - используется когда:
- Задача на **корневом уровне** (прямой запрос пользователя)
- **Нет контекста** от других задач (subtaskResults, previousResults)
- Сложность: **simple** или **medium**
- Нужно **самостоятельно спланировать** и выполнить workflow

### Что делает?

1. **Планирует** последовательность действий
2. **Выполняет** multi-step workflows (3-5+ шагов)
3. **Обрабатывает** условную логику (if/else)
4. **Синтезирует** данные из нескольких MCP вызовов

### Паттерны работы:

```typescript
// Pattern 1: Sequential
"Прочитай письмо от Анны и назначь встречу"
→ Read email → Parse time → Check calendar → Create event

// Pattern 2: Conditional
"Если завтра свободно, создай встречу с Петром"
→ Check calendar → IF free THEN create event ELSE suggest alternatives

// Pattern 3: Data synthesis
"Найди письма о проекте за неделю и резюмируй"
→ Search emails → Read relevant → Synthesize → Summarize
```

### Вызывается из:

```typescript
// intelligentSupervisor.ts
executeDirectly()        // simple tasks
executeFlatWorkflow()    // medium tasks
```

---

## ⚙️ Executor

### Когда используется?

✅ **ДА** - используется когда:
- Задача **внутри иерархии** (complex root task разбит на подзадачи)
- **Есть контекст** (subtaskResults, previousResults, parent task info)
- Любая сложность (simple/medium/complex)
- Работает на **любом уровне вложенности** (1, 2, 3, 4, 5)

### Что делает?

**Режим 1: Aggregation** (есть subtaskResults)
- Синтезирует результаты всех подзадач
- Формирует comprehensive ответ
- НЕ делает новых MCP вызовов (только синтез)

**Режим 2: Leaf Execution** (нет subtaskResults)
- Выполняет конечную задачу в дереве
- Использует previousResults как контекст
- Может делать 2-3 шаговые workflows
- Делает MCP вызовы для выполнения

### Паттерны работы:

```typescript
// Pattern 1: Aggregation
Task: "Организовать корпоратив" (parent)
SubtaskResults:
  - "Найдена площадка: Лофт Красная Роза, 100 человек"
  - "Приглашения отправлены: 95 из 100 участников"
→ Executor синтезирует: "Корпоратив организован..."

// Pattern 2: Leaf execution with context
Task: "Создай встречу с участниками" (leaf, level 2)
PreviousResults: ["Найдены участники: Иван, Петр, Мария"]
→ Executor: Check calendar → Create event with 3 participants

// Pattern 3: Focused multi-step
Task: "Проверь доступность и забронируй" (leaf, level 1)
→ Executor: Check availability → IF available THEN book
```

### Вызывается из:

```typescript
// taskOrchestrator.ts → intelligentSupervisor.ts
executeSingleTaskWithAgent()  // для любых задач в иерархии
```

---

## 🔄 Визуальное сравнение

### Сценарий 1: Simple task → WorkflowOrchestrator

```
User: "Прочитай письмо от Анны"

IntelligentSupervisor
  ├─ ComplexityAssessor → "simple"
  ├─ Strategy: "direct"
  └─ WorkflowOrchestrator
       └─ Read email (MCP) → Return result ✅
```

### Сценарий 2: Medium task → WorkflowOrchestrator

```
User: "Прочитай письмо от Анны и назначь встречу"

IntelligentSupervisor
  ├─ ComplexityAssessor → "medium"
  ├─ Strategy: "flat"
  └─ WorkflowOrchestrator
       ├─ Read email (MCP)
       ├─ Parse proposed time
       ├─ Check calendar (MCP)
       └─ Create event (MCP) → Return result ✅
```

### Сценарий 3: Complex task → Executor (hierarchical)

```
User: "Организовать корпоратив для 100 человек"

IntelligentSupervisor
  ├─ ComplexityAssessor → "complex"
  ├─ Strategy: "hierarchical"
  └─ TaskOrchestrator
       ├─ DecisionAgent → breakdown = YES
       ├─ Subtask 1 (level 1): "Найти площадку"
       │    ├─ DecisionAgent → breakdown = NO
       │    └─ Executor (LEAF) → Search venue (MCP) ✅
       │
       ├─ Subtask 2 (level 1): "Пригласить участников"
       │    ├─ DecisionAgent → breakdown = YES
       │    ├─ Subtask 2.1 (level 2): "Найти email"
       │    │    └─ Executor (LEAF) → Search emails (MCP) ✅
       │    ├─ Subtask 2.2 (level 2): "Отправить"
       │    │    └─ Executor (LEAF) → Send invites (MCP) ✅
       │    └─ Subtask 2 (aggregation)
       │         └─ Executor (AGGREGATION) → Synthesize 2.1 + 2.2 ✅
       │
       └─ Root task (aggregation)
            └─ Executor (AGGREGATION) → Synthesize all ✅
```

---

## 🎓 Ключевые отличия

### 1. Контекст

**WorkflowOrchestrator:**
```typescript
// Получает только:
- taskDescription (от пользователя)
- conversationContext (история диалога)
// НЕТ: previousResults, subtaskResults, parent task info
```

**Executor:**
```typescript
// Получает полный контекст:
- task.description
- task.subtaskResults (если есть)
- previousResults (результаты соседних задач)
- conversationContext
- task.level (уровень вложенности)
```

### 2. Планирование

**WorkflowOrchestrator:**
- Сам планирует последовательность шагов
- Принимает решения о conditional logic
- Не имеет контекста от других агентов

**Executor:**
- Получает готовую задачу (уже декомпозирована)
- Использует контекст от других задач
- Либо выполняет leaf task, либо агрегирует subtasks

### 3. Workflow complexity

**WorkflowOrchestrator:**
- Сложные workflows: 3-5+ шагов
- Conditional logic с множественными ветвлениями
- Data synthesis из нескольких источников

**Executor:**
- Фокусированные workflows: 2-3 шага
- Простая условная логика
- Использует контекст вместо повторного поиска

---

## ❓ FAQ

### Может ли подзадача уровня 3 попасть на WorkflowOrchestrator?

**НЕТ.** WorkflowOrchestrator используется ТОЛЬКО на корневом уровне для simple/medium задач.

Все задачи внутри иерархий (любой уровень: 1, 2, 3, 4, 5) выполняются **только через Executor**.

### Почему не объединить в один агент?

Мы рассмотрели этот вариант. Решили сохранить разделение, потому что:

1. **Специализация** - каждый агент оптимизирован под свой контекст
2. **Промпт фокус** - WorkflowOrchestrator детально описывает сложные паттерны, Executor - работу с контекстом
3. **Отладка** - проще понять, какой агент сработал
4. **Гибкость** - можем улучшать каждого независимо

### Если добавить workflow capabilities в Executor, не будет ли дублирования?

**Ответ:** Executor УЖЕ имеет workflow capabilities, но **фокусированные** (2-3 шага).

WorkflowOrchestrator имеет **расширенные** workflow capabilities (5+ шагов, complex conditional logic).

Это разделение по **масштабу** и **контексту**, не по функциональности.

### Когда изменить эту архитектуру?

Если в будущем:
- Промпты станут слишком похожими (>80% дублирования)
- Сложность поддержки двух агентов превысит выгоду от специализации
- Появятся новые агенты для других контекстов

Тогда стоит пересмотреть и вернуться к варианту UniversalExecutor.

---

## 📊 Метрики использования

```
Total requests: 100%

├─ Simple (30%) → WorkflowOrchestrator (direct)
├─ Medium (40%) → WorkflowOrchestrator (flat)
└─ Complex (30%) → Executor (hierarchical)
                    ├─ Leaf execution (60%)
                    └─ Aggregation (40%)
```

---

**Вывод:** Разделение ролей четкое и обоснованное. WorkflowOrchestrator = ROOT, Executor = HIERARCHY.

