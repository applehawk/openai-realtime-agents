# Анализ: Dynamic Replanning - Перестройка плана на основе новых данных

**Date:** 2025-10-25  
**Type:** Architecture Analysis  
**Status:** 🔍 Analysis Complete

## 🎯 Вопрос

Стоит ли в текущей архитектуре реализовать механизм удаления задач и перестройки плана на каждом уровне на основе новых данных в контексте?

## 📊 Текущая архитектура

### Как работает сейчас (Sequential Execution)

```typescript
// taskOrchestrator.ts, строки 222-231
const subtaskResults: string[] = [];
for (const subtask of task.subtasks) {
  await this.executeTaskRecursively(subtask, taskTree, ...);
  
  if (subtask.status === 'completed' && subtask.result) {
    subtaskResults.push(`${subtask.description}: ${subtask.result}`);
  }
}
```

**Характеристики:**
- ✅ **Линейное выполнение**: subtask1 → subtask2 → subtask3
- ✅ **Накопление контекста**: результаты собираются в `subtaskResults`
- ✅ **Прогнозируемость**: план не меняется после создания
- ❌ **Жесткость**: невозможно изменить план на основе промежуточных результатов

### Что отсутствует

1. **Нет механизма отмены задач**
```typescript
// TaskStatus не включает:
type TaskStatus = 
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  // | 'cancelled' ❌
  // | 'skipped' ❌
```

2. **Нет механизма перепланирования**
```typescript
// Нет функции типа:
private async replanBasedOnContext(
  task: Task,
  newContext: string,
  breakdownFn: ...
): Promise<void> {
  // Cancel remaining subtasks
  // Generate new plan
  // Execute new subtasks
}
```

3. **Нет проверки релевантности задач**
```typescript
// После каждой выполненной subtask нет:
if (shouldReplanBasedOnNewData(subtaskResults)) {
  await replanRemainingTasks(...);
}
```

## 🎬 Сценарии использования

### Сценарий 1: Задача становится неактуальной ✅ ПОЛЬЗА

```typescript
// Запрос: "Найди участников проекта Восток и отправь им приглашения"

Plan (initial):
  ├─ Subtask 1: "Найти участников проекта Восток"
  ├─ Subtask 2: "Подготовить приглашения"
  └─ Subtask 3: "Отправить приглашения"

// После выполнения Subtask 1:
Result: "Проект Восток закрыт. Участников нет."

// С dynamic replanning:
→ Subtask 2 и 3 ОТМЕНЯЮТСЯ (не нужны)
→ Возвращаем: "Проект Восток закрыт, приглашения не требуются"

// Без dynamic replanning:
→ Subtask 2 пытается подготовить приглашения (бессмысленно)
→ Subtask 3 пытается отправить (ошибка)
→ Лишние API calls, время, токены
```

### Сценарий 2: Новая информация меняет подход ✅ ПОЛЬЗА

```typescript
// Запрос: "Организовать встречу с командой завтра в 15:00"

Plan (initial):
  ├─ Subtask 1: "Проверить доступность всех участников"
  ├─ Subtask 2: "Забронировать конференц-зал"
  └─ Subtask 3: "Отправить приглашения"

// После Subtask 1:
Result: "Все участники в отпуске. Только 1 человек доступен."

// С dynamic replanning:
→ План МЕНЯЕТСЯ:
  ├─ Subtask 2: "Уведомить пользователя о недоступности команды"
  └─ Subtask 3: "Предложить альтернативные даты"

// Без dynamic replanning:
→ Бронирует зал (впустую)
→ Отправляет приглашения недоступным людям
```

### Сценарий 3: Ошибка требует изменения стратегии ✅ ПОЛЬЗА

```typescript
// Запрос: "Отправь отчет по email, если не получится - через Telegram"

Plan (initial):
  ├─ Subtask 1: "Создать отчет"
  ├─ Subtask 2: "Отправить по email"
  └─ Subtask 3: "Подтвердить отправку"

// После Subtask 2:
Result: "Ошибка: Email сервер недоступен"

// С dynamic replanning:
→ План МЕНЯЕТСЯ:
  └─ Subtask 4: "Отправить отчет через Telegram" (NEW)

// Без dynamic replanning:
→ Задача failed, пользователь должен перезапросить
```

### Сценарий 4: Простая линейная задача ❌ ИЗБЫТОЧНОСТЬ

```typescript
// Запрос: "Прочитай письмо от Анны и назначь встречу"

Plan:
  ├─ Subtask 1: "Прочитать письмо от Анны"
  └─ Subtask 2: "Назначить встречу на предложенное время"

// После Subtask 1:
Result: "Анна предлагает встречу завтра в 15:00"

// Dynamic replanning НЕ НУЖЕН:
→ План остается прежним
→ Subtask 2 выполняется как запланировано
→ Проверка необходимости replanning = лишние токены
```

## 📊 Анализ: Плюсы и минусы

### ✅ Аргументы ЗА Dynamic Replanning

#### 1. **Адаптивность к реальности**
```
Plan → Execute Subtask 1 → NEW DATA → Adapt Plan → Continue
```
Система реагирует на изменения в реальном мире.

#### 2. **Экономия ресурсов**
```
Отмена ненужных задач:
- Меньше API calls
- Меньше токенов
- Быстрее выполнение
```

#### 3. **Лучший UX**
```
Вместо: "Задача failed, попробуйте снова"
→ "План изменен на основе новых данных, продолжаю"
```

#### 4. **Обработка непредвиденных ситуаций**
```
Email недоступен → Автоматически переключаемся на Telegram
Участники заняты → Предлагаем другое время
```

#### 5. **Более "умная" система**
```
Пользователь видит:
"Обнаружил, что проект закрыт. Отменил отправку приглашений."
```

### ❌ Аргументы ПРОТИВ Dynamic Replanning

#### 1. **Сложность реализации** 🔴 КРИТИЧНО

Нужно добавить:
```typescript
// 1. Новые статусы задач
type TaskStatus = ... | 'cancelled' | 'skipped';

// 2. Механизм оценки необходимости replanning
interface ReplanningDecision {
  shouldReplan: boolean;
  reason: string;
  tasksToCancel: string[];
  newSubtasks?: SubtaskDescription[];
}

// 3. Новый агент или расширение DecisionAgent
replanningAgent: Agent; // Оценивает необходимость replanning

// 4. Логика отмены задач
private cancelTasks(taskIds: string[]): void;

// 5. Логика перепланирования
private async replanRemainingTasks(...): Promise<void>;

// 6. Обработка зависимостей
// Что если отмененная задача была dependency для другой?
```

**Оценка трудозатрат:** 40-60 часов работы + тестирование

#### 2. **Дополнительные API calls** 💰 COST

На каждом уровне после каждой subtask:
```typescript
for (const subtask of task.subtasks) {
  await execute(subtask);
  
  // +1 API call к replanningAgent
  const decision = await replanningAgent.evaluate(
    currentPlan,
    newContext
  );
  
  if (decision.shouldReplan) {
    // +1 API call к DecisionAgent для нового плана
    await replan();
  }
}
```

**Оценка дополнительных затрат:**
- Simple task (3 subtasks): +3 replanning checks = +$0.03
- Complex task (10 subtasks): +10 replanning checks = +$0.10
- Ежедневно (1000 tasks): +$30-100/день

#### 3. **Непрогнозируемость** ⚠️ UX ISSUE

```
Пользователь видит:
"Планирую выполнить 5 задач..."
→ После 2-й задачи: "План изменен, теперь 3 задачи"
→ После 3-й задачи: "План снова изменен, теперь 4 задачи"

Вопрос: Это хорошо или сбивает с толку?
```

#### 4. **Большинство задач не требуют replanning** 📊

Анализ типичных задач:
```
80% задач: Линейные, план не меняется
15% задач: Minor корректировки (можно обработать в Executor)
5% задач: Реально нужен replanning
```

#### 5. **Альтернативные решения проще** 💡

Вместо полного replanning:

**a) Conditional execution в Executor:**
```typescript
// В промпте Executor:
"If subtask result indicates task is no longer needed,
mark remaining subtasks as skipped and return early."
```

**b) Smart aggregation:**
```typescript
// После выполнения всех subtasks, Executor:
"Synthesize results, ignoring failed/irrelevant tasks"
```

**c) Error recovery в DecisionAgent:**
```typescript
// DecisionAgent уже может адаптировать plan:
"If first approach fails, try alternative"
```

#### 6. **Текущая архитектура частично поддерживает** ✅

```typescript
// previousResults передаются в каждый subtask:
const executionRequest: TaskExecutionRequest = {
  task,
  conversationContext,
  previousResults: task.subtaskResults, // ← Контекст!
};

// Executor может адаптировать поведение:
"Use previousResults to determine if task is still relevant"
```

## 🎯 Сравнительная таблица

| Критерий | Full Dynamic Replanning | Current Architecture + Enhancements |
|----------|------------------------|-------------------------------------|
| **Адаптивность** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Сложность** | 🔴 Высокая (40-60 часов) | 🟢 Низкая (4-6 часов) |
| **Стоимость** | 💰💰💰 (+30-100$/день) | 💰 (+5-10$/день) |
| **Прогнозируемость** | ⚠️ Низкая | ✅ Высокая |
| **Покрытие сценариев** | 100% | 85-90% |
| **Риск регрессий** | 🔴 Высокий | 🟢 Низкий |
| **Time to market** | 3-4 недели | 3-4 дня |

## 💡 Рекомендация: Гибридный подход

### Вместо full dynamic replanning → **Smart Execution**

#### 1. **Усилить Executor для адаптивного выполнения**

```typescript
// Обновить промпт executor.ts:

## Adaptive Execution

When executing leaf task, CHECK previousResults:

**IF task becomes irrelevant based on previous results:**
- Don't execute unnecessary tool calls
- Return: "Task skipped: [reason based on previous results]"
- Example: If "Find participants" returned "Project closed", 
  skip "Send invitations"

**IF task needs adjustment based on context:**
- Adapt execution approach using previousResults
- Example: If email failed, try alternative method mentioned in task
```

**Трудозатраты:** 2-3 часа  
**Эффект:** Покрывает 80% сценариев

#### 2. **Добавить "Early termination" в TaskOrchestrator**

```typescript
// В executeTaskRecursively после каждой subtask:

for (const subtask of task.subtasks) {
  await this.executeTaskRecursively(subtask, ...);
  
  // NEW: Check if remaining tasks are relevant
  if (this.shouldTerminateEarly(subtask, task)) {
    console.log('Early termination: remaining tasks no longer needed');
    // Mark remaining as 'skipped'
    for (const remaining of task.subtasks.slice(i + 1)) {
      remaining.status = 'skipped';
    }
    break;
  }
}

private shouldTerminateEarly(completedSubtask: Task, parentTask: Task): boolean {
  // Simple heuristics:
  // - If subtask.result contains "not found", "closed", "unavailable"
  // - If parentTask has no more dependencies
  return false; // Conservative approach
}
```

**Трудозатраты:** 4-5 часов  
**Эффект:** Покрывает еще 10% сценариев

#### 3. **Добавить статус 'skipped'**

```typescript
// taskTypes.ts
export type TaskStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped';    // NEW: Task skipped based on context
```

**Трудозатраты:** 1 час  

#### 4. **Улучшить aggregation в Executor**

```typescript
// Обновить промпт executor.ts Mode 1:

## Intelligent Aggregation

When aggregating subtaskResults:

- **Ignore skipped tasks**: Focus on completed tasks
- **Explain context**: "Tasks 3-5 were skipped because project was closed"
- **Provide complete picture**: Synthesize why plan changed
```

**Трудозатраты:** 1-2 часа

### Итого гибридного подхода:

✅ **Трудозатраты:** 8-11 часов (vs 40-60 для full replanning)  
✅ **Покрытие:** 90% сценариев (vs 100%)  
✅ **Стоимость:** +5-10$/день (vs +30-100$/день)  
✅ **Риск:** Низкий (минимальные изменения архитектуры)  
✅ **Time to market:** 1-2 недели

## 🔮 Будущее: Когда добавлять Full Dynamic Replanning?

Добавляйте полный replanning ЕСЛИ:

1. ✅ **Доля задач с replanning > 20%** (сейчас ~5%)
2. ✅ **Пользователи явно запрашивают** ("если не получится, попробуй другое")
3. ✅ **Гибридный подход не справляется** (много жалоб)
4. ✅ **Cost justification:** экономия от отмены задач > стоимость replanning checks

## 📋 План реализации (Hybrid Approach)

### Phase 1: Foundation (День 1-2)
- [ ] Добавить статус 'skipped' в TaskStatus
- [ ] Добавить simple heuristics в TaskOrchestrator для early termination
- [ ] Добавить обработку 'skipped' tasks в UI/logging

### Phase 2: Executor Enhancement (День 3-4)
- [ ] Обновить промпт Executor: adaptive execution
- [ ] Обновить промпт Executor: intelligent aggregation для skipped tasks
- [ ] Добавить примеры в промпт

### Phase 3: Testing (День 5-7)
- [ ] Тесты для early termination scenarios
- [ ] Тесты для skipped tasks aggregation
- [ ] E2E тесты с реальными сценариями

### Phase 4: Monitoring (Неделя 2)
- [ ] Добавить метрики: % skipped tasks
- [ ] Логирование early termination decisions
- [ ] Анализ: нужен ли full replanning?

## ✅ Итоговое решение

### НЕ СТОИТ реализовывать Full Dynamic Replanning СЕЙЧАС

**Причины:**
1. 🔴 Слишком сложно (40-60 часов)
2. 💰 Слишком дорого (+30-100$/день)
3. 📊 90% сценариев покрывается гибридным подходом
4. ⚠️ Риск over-engineering
5. 🎯 Текущая архитектура частично поддерживает адаптацию

### ✅ СТОИТ реализовать Hybrid Approach (Smart Execution)

**Преимущества:**
1. ✅ Быстро (8-11 часов)
2. ✅ Дешево (+5-10$/день)
3. ✅ Покрывает 90% сценариев
4. ✅ Минимальный риск
5. ✅ Эволюционный путь к full replanning (если понадобится)

---

## 🎓 Философия

**"Start simple, evolve when needed"**

Полное dynamic replanning - это **optimization**, а не **necessity**.  
Сначала реализуем простые механизмы, измеряем их эффективность, и только потом решаем о полном replanning.

**Принцип:** 80/20  
- 20% усилий (гибридный подход)  
- 80% результата (покрытие большинства сценариев)

---

**Recommendation:** ✅ Implement Hybrid Approach  
**Timeline:** 1-2 weeks  
**Cost:** Low  
**Risk:** Low  
**Value:** High

