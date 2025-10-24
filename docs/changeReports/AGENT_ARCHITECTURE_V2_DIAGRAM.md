# Agent Architecture v2.0 - Визуальная Диаграмма

## Архитектура До v2.0

```
┌─────────────────────────────────────────────────────────────────┐
│                    IntelligentSupervisor                        │
│                                                                 │
│  assessComplexity() → selectStrategy() → execute()              │
│                                                                 │
│                            ↓                                    │
│                                                                 │
│              ┌─────────────────────────────┐                   │
│              │   supervisorAgent (монолит)  │                   │
│              │                             │                   │
│              │  ❌ Принятие решений        │                   │
│              │  ❌ Декомпозиция            │                   │
│              │  ❌ Выполнение задач        │                   │
│              │  ❌ Агрегация результатов    │                   │
│              │  ❌ Генерация отчётов       │                   │
│              │                             │                   │
│              │  Промпт: 560+ строк 😱       │                   │
│              │  Смешанная ответственность   │                   │
│              └─────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Проблемы:
❌ Слишком частая декомпозиция (дорого!)
❌ Перегруженный промпт (низкая точность)
❌ Сложная отладка (всё смешано)
```

## Архитектура После v2.0

```
┌─────────────────────────────────────────────────────────────────┐
│                    IntelligentSupervisor                        │
│                                                                 │
│  assessComplexity() → selectStrategy() → execute()              │
│                                                                 │
│                            ↓                                    │
│                                                                 │
│     ┌──────────────────┐         ┌──────────────────┐          │
│     │  DecisionAgent   │         │  ExecutorAgent   │          │
│     │  (NEW v2.0)      │         │  (NEW v2.0)      │          │
│     │                  │         │                  │          │
│     │ ✅ ONE JOB:      │         │ ✅ ONE JOB:      │          │
│     │ Breakdown?       │         │ Execute/         │          │
│     │                  │         │ Aggregate        │          │
│     │ 🎯 Default: NO!  │         │                  │          │
│     │ (95% случаев)    │         │ 🛠️ MCP Tools    │          │
│     │                  │         │                  │          │
│     │ 🚫 No tools      │         │ ⚡ Fast          │          │
│     │ 📝 Короткий      │         │ 📝 Средний       │          │
│     │    промпт        │         │    промпт        │          │
│     └──────────────────┘         └──────────────────┘          │
│                                                                 │
│     ┌─────────────────────────────────────────┐                │
│     │  supervisorAgent (Legacy)               │                │
│     │  @deprecated - backward compatibility   │                │
│     └─────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Преимущества:
✅ Минимизация декомпозиции (-70%)
✅ Специализированные промпты (выше точность)
✅ Чёткая ответственность (легче отладка)
```

## Поток Выполнения: Простая Задача

**Задача:** "Прочитай последнее письмо от Анны"

```
User Request
    ↓
IntelligentSupervisor.assessComplexity()
    ↓
"simple" → selectStrategy() → "direct"
    ↓
executeDirectly() → supervisorAgent
    ↓
✅ Result (1 LLM call)

DecisionAgent: НЕ ВЫЗЫВАЕТСЯ (стратегия "direct")
ExecutorAgent: НЕ ВЫЗЫВАЕТСЯ (стратегия "direct")
```

## Поток Выполнения: Средняя Задача (NO breakdown)

**Задача:** "Прочитай письмо от Анны и назначь встречу"

```
User Request
    ↓
IntelligentSupervisor.assessComplexity()
    ↓
"medium" → selectStrategy() → "hierarchical"
    ↓
TaskOrchestrator.executeTaskRecursively()
    ↓
    ┌───────────────────────────────────────┐
    │  DecisionAgent                        │
    │  "Should we break down this task?"    │
    │                                       │
    │  Input:                               │
    │  - Task: "Прочитай письмо..."         │
    │  - Level: 0                           │
    │  - Complexity: medium                 │
    │                                       │
    │  Analysis:                            │
    │  ❌ Only 2 steps                      │
    │  ❌ Agent can handle sequentially     │
    │  ❌ No complex logic                  │
    │                                       │
    │  Decision:                            │
    │  shouldBreakdown = FALSE ✅           │
    │  reasoning: "2 простых шага"          │
    └───────────────────────────────────────┘
    ↓
    ┌───────────────────────────────────────┐
    │  ExecutorAgent                        │
    │  "Execute task directly"              │
    │                                       │
    │  1. Read email (MCP call)             │
    │  2. Parse proposed time               │
    │  3. Create calendar event (MCP call)  │
    │                                       │
    │  Result:                              │
    │  "Письмо от Анны получено вчера..."   │
    │  workflowSteps: [...]                 │
    └───────────────────────────────────────┘
    ↓
✅ Result (2 LLM calls)

До v2.0: 5-7 вызовов (breakdown на подзадачи)
Экономия: ~70% ✅
```

## Поток Выполнения: Сложная Задача (YES breakdown)

**Задача:** "Найди 50 участников проекта Восток, проверь их доступность завтра, отправь каждому персональное приглашение"

```
User Request
    ↓
IntelligentSupervisor.assessComplexity()
    ↓
"complex" → selectStrategy() → "hierarchical"
    ↓
TaskOrchestrator.executeTaskRecursively()
    ↓
    ┌───────────────────────────────────────┐
    │  DecisionAgent (Root Task)            │
    │  "Should we break down this task?"    │
    │                                       │
    │  Input:                               │
    │  - Task: "Найди 50 участников..."     │
    │  - Level: 0                           │
    │  - Complexity: complex                │
    │                                       │
    │  Analysis:                            │
    │  ✅ 5+ different operations           │
    │  ✅ Large dataset (50 people)         │
    │  ✅ Per-item personalization          │
    │  ✅ Crosses multiple domains          │
    │                                       │
    │  Decision:                            │
    │  shouldBreakdown = TRUE ✅            │
    │  subtasks: [                          │
    │    "Найти всех участников",           │
    │    "Проверить доступность",           │
    │    "Отправить приглашения"            │
    │  ]                                    │
    └───────────────────────────────────────┘
    ↓
    ┌──────────────────────────────────────────────────────┐
    │  Subtask 1: "Найти всех участников проекта Восток"  │
    │                                                      │
    │  DecisionAgent: shouldBreakdown = FALSE              │
    │  (уже достаточно простая подзадача)                  │
    │     ↓                                                │
    │  ExecutorAgent:                                      │
    │  - Query RAG for "проект Восток"                     │
    │  - Extract participant names                         │
    │  - Result: "Найдено 50 участников: ..."              │
    └──────────────────────────────────────────────────────┘
    ↓
    ┌──────────────────────────────────────────────────────┐
    │  Subtask 2: "Проверить доступность каждого"         │
    │                                                      │
    │  DecisionAgent: shouldBreakdown = FALSE              │
    │  (подзадача уже простая)                             │
    │     ↓                                                │
    │  ExecutorAgent:                                      │
    │  - previousResults: "50 участников"                  │
    │  - Check calendar for each (MCP calls)               │
    │  - Result: "Доступно 35 участников"                  │
    └──────────────────────────────────────────────────────┘
    ↓
    ┌──────────────────────────────────────────────────────┐
    │  Subtask 3: "Отправить персональные приглашения"    │
    │                                                      │
    │  DecisionAgent: shouldBreakdown = FALSE              │
    │  (подзадача уже простая)                             │
    │     ↓                                                │
    │  ExecutorAgent:                                      │
    │  - previousResults: "35 доступных"                   │
    │  - Send personalized emails (MCP calls)              │
    │  - Result: "Отправлено 35 приглашений"               │
    └──────────────────────────────────────────────────────┘
    ↓
    ┌──────────────────────────────────────────────────────┐
    │  Parent Task: Aggregation                            │
    │                                                      │
    │  ExecutorAgent (aggregation mode):                   │
    │  - subtaskResults: [                                 │
    │      "Найдено 50 участников",                        │
    │      "Доступно 35 участников",                       │
    │      "Отправлено 35 приглашений"                     │
    │    ]                                                 │
    │  - Synthesize comprehensive answer                   │
    │  - Result: "Найдено 50 участников проекта Восток..." │
    └──────────────────────────────────────────────────────┘
    ↓
✅ Result (7-9 LLM calls)

Ключевое отличие:
✅ Подзадачи НЕ разбиваются дальше (DecisionAgent → NO)
✅ Минимум необходимых вызовов
✅ Контекст передаётся через previousResults
```

## Comparison: v1.0 vs v2.0

### Средняя задача: "Прочитай письмо и назначь встречу"

```
┌──────────────────────────────────────────────────────────────┐
│  До v2.0 (5-7 LLM calls)                                     │
├──────────────────────────────────────────────────────────────┤
│  1. supervisorAgent: Breakdown decision → YES (ошибка!)      │
│  2. supervisorAgent: Create subtask "Прочитай письмо"        │
│  3. supervisorAgent: Create subtask "Назначь встречу"        │
│  4. supervisorAgent: Execute subtask 1                       │
│  5. supervisorAgent: Execute subtask 2                       │
│  6. supervisorAgent: Aggregate results                       │
│  7. supervisorAgent: Generate report                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  После v2.0 (2 LLM calls) ✅                                 │
├──────────────────────────────────────────────────────────────┤
│  1. DecisionAgent: Breakdown decision → NO (правильно!)      │
│  2. ExecutorAgent: Execute task directly                     │
└──────────────────────────────────────────────────────────────┘

Экономия: 71% LLM calls
Ускорение: ~3x faster
```

### Сложная задача: "Найди 50 участников, проверь доступность, отправь приглашения"

```
┌──────────────────────────────────────────────────────────────┐
│  До v2.0 (15-20 LLM calls)                                   │
├──────────────────────────────────────────────────────────────┤
│  1. supervisorAgent: Breakdown root → YES                    │
│  2-4. Create 3 subtasks                                      │
│  5. supervisorAgent: Breakdown subtask 1 → YES (излишне!)    │
│  6-7. Create sub-subtasks for subtask 1                      │
│  8. supervisorAgent: Breakdown subtask 2 → YES (излишне!)    │
│  9-10. Create sub-subtasks for subtask 2                     │
│  11. supervisorAgent: Breakdown subtask 3 → YES (излишне!)   │
│  12-13. Create sub-subtasks for subtask 3                    │
│  14-18. Execute all sub-subtasks                             │
│  19. Aggregate subtask results                               │
│  20. Aggregate root task results                             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  После v2.0 (7-9 LLM calls) ✅                               │
├──────────────────────────────────────────────────────────────┤
│  1. DecisionAgent: Breakdown root → YES (обоснованно!)       │
│  2. DecisionAgent: Breakdown subtask 1 → NO (правильно!)     │
│  3. ExecutorAgent: Execute subtask 1                         │
│  4. DecisionAgent: Breakdown subtask 2 → NO (правильно!)     │
│  5. ExecutorAgent: Execute subtask 2                         │
│  6. DecisionAgent: Breakdown subtask 3 → NO (правильно!)     │
│  7. ExecutorAgent: Execute subtask 3                         │
│  8. ExecutorAgent: Aggregate parent task                     │
└──────────────────────────────────────────────────────────────┘

Экономия: 55% LLM calls
Ускорение: ~2x faster
```

## Decision Matrix (DecisionAgent)

```
┌─────────────────────────────────────────────────────────────┐
│  Количество операций   │  Сложность    │  Решение          │
├────────────────────────┼───────────────┼───────────────────┤
│  1-2 шага              │  Простая      │  ❌ NO breakdown  │
│  2-3 шага              │  Средняя      │  ❌ NO breakdown  │
│  3-4 шага              │  Средняя      │  🤔 Вероятно NO   │
│  4-5 шагов             │  Сложная      │  🤔 50/50         │
│  5+ шагов              │  Сложная      │  ✅ YES breakdown │
│  Большой dataset       │  Любая        │  ✅ YES breakdown │
│  (20+ элементов)       │               │                   │
│  Условная логика       │  Сложная      │  ✅ YES breakdown │
│  (множ. ветвления)     │               │                   │
└─────────────────────────────────────────────────────────────┘

Правило 5+: 
  5+ различных операций в разных доменах → breakdown
  5+ шагов в одном домене → вероятно NO breakdown
```

## Execution Modes (ExecutorAgent)

```
┌─────────────────────────────────────────────────────────────┐
│  Mode 1: DIRECT EXECUTION                                   │
│  (task.subtaskResults === undefined)                        │
├─────────────────────────────────────────────────────────────┤
│  Input:                                                     │
│    - task.description                                       │
│    - conversationContext                                    │
│    - previousResults (от sibling tasks)                     │
│                                                             │
│  Process:                                                   │
│    1. Understand task                                       │
│    2. Use MCP tools to execute                              │
│    3. Return detailed result                                │
│                                                             │
│  Output:                                                    │
│    {                                                        │
│      status: "completed",                                   │
│      result: "Детальный результат...",                      │
│      workflowSteps: ["Шаг 1", "Шаг 2"]                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Mode 2: AGGREGATION                                        │
│  (task.subtaskResults !== undefined)                        │
├─────────────────────────────────────────────────────────────┤
│  Input:                                                     │
│    - task.description                                       │
│    - task.subtaskResults: ["Результат 1", "Результат 2"]    │
│    - conversationContext                                    │
│                                                             │
│  Process:                                                   │
│    1. Read all subtask results                              │
│    2. Synthesize comprehensive answer                       │
│    3. Provide context-aware response                        │
│                                                             │
│  Output:                                                    │
│    {                                                        │
│      status: "completed",                                   │
│      result: "Агрегированный результат на основе...",       │
│      workflowSteps: [                                       │
│        "Собраны результаты подзадач",                       │
│        "Синтезирован итоговый ответ"                        │
│      ]                                                      │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
```

## Философия v2.0

```
┌──────────────────────────────────────────────────────────┐
│  "Декомпозиция — это крайняя мера, не правило"           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  DecisionAgent                                     │ │
│  │                                                    │ │
│  │  START                                             │ │
│  │    ↓                                               │ │
│  │  Assume: breakdown = NOT needed                    │ │
│  │    ↓                                               │ │
│  │  Check: Is this GENUINELY complex?                 │ │
│  │    ↓                                               │ │
│  │  YES? → breakdown = true                           │ │
│  │  NO?  → breakdown = false (DEFAULT!)               │ │
│  │    ↓                                               │ │
│  │  END                                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Result: 95% задач → NO breakdown                        │
│  Экономия: ~70% LLM calls                                │
└──────────────────────────────────────────────────────────┘
```

---

**Визуализация создана:** 2025-10-24  
**Версия:** 2.0  
**Статус:** ✅ Production Ready

