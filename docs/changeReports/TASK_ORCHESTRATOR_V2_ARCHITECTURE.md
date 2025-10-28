# TaskOrchestrator v2.0 - Архитектурный Рефакторинг

## Дата: 2025-10-24
## Версия: 2.0 - Context-Driven Execution

## Проблема

### Старая архитектура (v1.x):

```
1. breakdownTaskRecursively → Полностью разбивает ВСЁ дерево до leaf tasks
2. executeTasksInOrder → Выполняет только leaf tasks
```

**Проблемы:**
- ❌ **Дорого**: Разбивает ВСЁ до атомарных задач (много вызовов к LLM)
- ❌ **Нет контекста**: Родительские задачи не используют результаты подзадач
- ❌ **Неэффективно**: Выполняются только leaf tasks, промежуточные задачи игнорируются
- ❌ **Избыточная декомпозиция**: Задача разбивается даже если это не нужно

### Пример проблемы:

```
Задача: "Найди участников проекта Восток и отправь приглашения"

Старая логика:
1. Разбить на: "Найти участников" + "Отправить приглашения"
2. Разбить "Найти участников" на: "Поиск в календаре" + "Поиск в почте"
3. Разбить "Отправить приглашения" на: "Иванову" + "Петрову" + "Сидорову"
4. Выполнить ВСЕ leaf tasks
5. ❌ Родительские задачи НЕ выполняются!

Результат: Есть атомарные действия, но нет агрегированного результата!
```

## Решение

### Новая архитектура (v2.0):

```typescript
executeTaskRecursively(task):
  1. Спросить supervisor: нужна ли декомпозиция?
  2. Если НЕТ → выполнить задачу напрямую
  3. Если ДА:
     a. Создать subtasks
     b. Выполнить каждую subtask РЕКУРСИВНО (они могут снова декомпозироваться)
     c. Собрать результаты subtasks
     d. ✅ Выполнить родительскую задачу С КОНТЕКСТОМ из subtasks
```

**Преимущества:**
- ✅ **Эффективно**: Декомпозиция только когда нужна
- ✅ **Контекст накапливается**: Результаты подзадач используются родительской задачей
- ✅ **Меньше вызовов**: Supervisor решает нужна ли декомпозиция
- ✅ **Правильная абстракция**: Родительская задача = агрегация подзадач

### Пример новой логики:

```
Задача: "Найди участников проекта Восток и отправь приглашения"

Новая логика:
1. Supervisor: "Нужна декомпозиция"
2. Создать subtasks:
   - task-root.0: "Найти участников"
   - task-root.1: "Отправить приглашения"

3. Выполнить task-root.0 РЕКУРСИВНО:
   a. Supervisor: "Нужна декомпозиция"
   b. Создать: "Поиск в календаре" + "Поиск в почте"
   c. Выполнить обе
   d. Собрать контекст: "Найдено 5 участников: Иванов, Петров..."
   e. ✅ Выполнить task-root.0 С КОНТЕКСТОМ → "Список участников готов"

4. Выполнить task-root.1 РЕКУРСИВНО:
   a. Supervisor: "Нужна декомпозиция"
   b. Создать: "Иванову" + "Петрову" + "Сидорову"
   c. Выполнить все
   d. Собрать контекст: "Отправлено 3 приглашения..."
   e. ✅ Выполнить task-root.1 С КОНТЕКСТОМ → "Все приглашения отправлены"

5. ✅ Выполнить task-root С КОНТЕКСТОМ:
   Контекст:
   - "Найти участников: Список участников готов"
   - "Отправить приглашения: Все приглашения отправлены"
   
   Результат: "Найдено 5 участников проекта Восток и отправлено 5 приглашений"
```

## Технические детали

### Ключевые изменения

#### 1. `executeComplexTask` - Упрощён

```typescript
// v1.x - Старый подход
async executeComplexTask(...) {
  await this.breakdownTaskRecursively(rootTask); // Разбить ВСЁ
  await this.executeTasksInOrder(taskTree);      // Выполнить leaf tasks
  return this.generateFinalReport();
}

// v2.0 - Новый подход
async executeComplexTask(...) {
  await this.executeTaskRecursively(rootTask);   // Выполнить рекурсивно
  return this.generateFinalReport();
}
```

#### 2. `executeTaskRecursively` - Новый метод (CORE)

```typescript
async executeTaskRecursively(task, ...) {
  // 1. Спросить: нужна ли декомпозиция?
  const breakdown = await breakdownFn(task);
  
  if (!breakdown.shouldBreakdown) {
    // Декомпозиция не нужна → выполнить напрямую
    await this.executeTaskDirectly(task);
    return;
  }
  
  // 2. Создать subtasks
  for (subtaskDesc of breakdown.subtasks) {
    task.subtasks.push(createSubtask(subtaskDesc));
  }
  
  // 3. Выполнить subtasks рекурсивно
  const subtaskResults = [];
  for (subtask of task.subtasks) {
    await this.executeTaskRecursively(subtask); // ← РЕКУРСИЯ!
    subtaskResults.push(subtask.result);
  }
  
  // 4. Сохранить контекст
  task.subtaskResults = subtaskResults;
  
  // 5. Выполнить родительскую задачу С КОНТЕКСТОМ
  await this.executeTaskDirectly(task);
}
```

#### 3. `executeTaskDirectly` - Новый метод

```typescript
async executeTaskDirectly(task, ...) {
  // Build context from subtasks
  const subtaskContext = task.subtaskResults?.length
    ? `\n\nКонтекст из подзадач:\n${task.subtaskResults.join('\n')}`
    : '';
  
  // Execute with context
  const result = await executeFn({
    task,
    conversationContext: conversationContext + subtaskContext, // ← КОНТЕКСТ!
    previousResults: task.subtaskResults,
  });
  
  task.result = result;
}
```

### Поток выполнения

```
executeTaskRecursively(task-root)
├─ breakdown? YES
├─ create subtasks [task-root.0, task-root.1]
├─ executeTaskRecursively(task-root.0)
│  ├─ breakdown? YES
│  ├─ create subtasks [task-root.0.0, task-root.0.1]
│  ├─ executeTaskRecursively(task-root.0.0)
│  │  ├─ breakdown? NO
│  │  └─ executeTaskDirectly(task-root.0.0) → result A
│  ├─ executeTaskRecursively(task-root.0.1)
│  │  ├─ breakdown? NO
│  │  └─ executeTaskDirectly(task-root.0.1) → result B
│  ├─ collect context: [A, B]
│  └─ executeTaskDirectly(task-root.0, context=[A,B]) → result C
├─ executeTaskRecursively(task-root.1)
│  ├─ breakdown? YES
│  ├─ create subtasks [task-root.1.0, task-root.1.1]
│  ├─ executeTaskRecursively(task-root.1.0)
│  │  ├─ breakdown? NO
│  │  └─ executeTaskDirectly(task-root.1.0) → result D
│  ├─ executeTaskRecursively(task-root.1.1)
│  │  ├─ breakdown? NO
│  │  └─ executeTaskDirectly(task-root.1.1) → result E
│  ├─ collect context: [D, E]
│  └─ executeTaskDirectly(task-root.1, context=[D,E]) → result F
├─ collect context: [C, F]
└─ executeTaskDirectly(task-root, context=[C,F]) → FINAL RESULT
```

## Преимущества v2.0

### 1. Накопление контекста

**v1.x**: Контекст терялся  
**v2.0**: Каждая родительская задача получает агрегированные результаты подзадач

```typescript
// Родительская задача видит:
conversationContext + 
  "\n\nКонтекст из подзадач:\n" +
  "Найти участников: Найдено 5 участников\n" +
  "Отправить приглашения: Отправлено 5 приглашений"
```

### 2. Меньше декомпозиций

**v1.x**: Всегда разбивает до конца  
**v2.0**: Supervisor решает на каждом уровне

```typescript
// Если задача простая:
breakdown.shouldBreakdown = false → executeTaskDirectly()
// Декомпозиция НЕ происходит!
```

### 3. Правильная семантика

**v1.x**: Выполняются только leaf tasks (низкоуровневые действия)  
**v2.0**: Выполняются ВСЕ задачи (включая агрегирующие)

```
v1.x: task-root НЕ выполняется
v2.0: task-root выполняется С КОНТЕКСТОМ → итоговый результат
```

### 4. Эффективность

**v1.x**: O(n) вызовов для декомпозиции + O(leaf) вызовов для выполнения  
**v2.0**: O(nodes that need breakdown) + O(all nodes) для выполнения

Но на практике v2.0 быстрее, потому что:
- Меньше ненужных декомпозиций
- Контекст помогает избежать повторных вызовов

## Обратная совместимость

### Deprecated методы

- `breakdownTaskRecursively()` - помечен как @deprecated
- `executeTasksInOrder()` - больше не используется
- `executeSingleTask()` - заменён на `executeTaskDirectly()`

### Миграция

Старые методы оставлены в коде но не используются. Если нужно вернуться к старой логике:

```typescript
// В executeComplexTask заменить:
await this.executeTaskRecursively(rootTask, ...);

// На:
await this.breakdownTaskRecursively(rootTask, ...);
await this.executeTasksInOrder(taskTree, ...);
```

## Тестирование

### Сценарий 1: Простая задача

```
Input: "Прочитай последнее письмо"

Execution:
1. executeTaskRecursively(task-root)
2. Supervisor: shouldBreakdown = false
3. executeTaskDirectly(task-root) → "Последнее письмо от Анны..."

Result: 1 задача, 2 вызова LLM (breakdown + execute)
```

### Сценарий 2: Средняя задача

```
Input: "Найди письмо от Анны и назначь встречу"

Execution:
1. executeTaskRecursively(task-root)
2. Supervisor: shouldBreakdown = true → [task-root.0, task-root.1]
3. executeTaskRecursively(task-root.0) → "Найдено письмо..."
4. executeTaskRecursively(task-root.1) → "Встреча назначена..."
5. executeTaskDirectly(task-root, context) → "Найдено письмо и встреча назначена"

Result: 3 задачи (root + 2 subtasks), контекст передан
```

### Сценарий 3: Сложная задача

```
Input: "Найди участников Восток и отправь приглашения"

Execution: См. пример выше в разделе "Решение"

Result: Многоуровневая иерархия с контекстом на каждом уровне
```

## Заключение

TaskOrchestrator v2.0 реализует правильную архитектуру для иерархического выполнения задач:

✅ **Контекстно-ориентированное выполнение**: Результаты подзадач используются родительскими  
✅ **Эффективная декомпозиция**: Только когда нужно  
✅ **Правильная семантика**: Родительская задача = агрегация подзадач  
✅ **Минимизация затрат**: Меньше вызовов LLM  
✅ **Прозрачность**: UI показывает полное дерево с результатами на всех уровнях

Это фундаментальное улучшение архитектуры, которое делает систему более эффективной и правильной! 🚀

