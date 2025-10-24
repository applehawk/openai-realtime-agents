# Task Tree Visualization Implementation

## Дата: 2025-10-24
## Версия: 1.1 - Incremental Tree Updates
## Версия: 1.1.1 - Fixed breakdown order for true incremental updates
## Версия: 1.2 - Real-time task execution status updates
## Версия: 1.2.1 - Fixed deep nesting visibility
## Версия: 2.0 - Context-driven execution architecture

**ВАЖНО**: Версия 2.0 - критический архитектурный рефакторинг TaskOrchestrator. См. [TASK_ORCHESTRATOR_V2_ARCHITECTURE.md](./TASK_ORCHESTRATOR_V2_ARCHITECTURE.md) для деталей.

## Описание

Добавлена интерактивная визуализация дерева задач для отображения иерархической декомпозиции задач, выполняемых IntelligentSupervisor.

**ОБНОВЛЕНИЕ v1.1**: Дерево задач теперь обновляется в реальном времени после каждой операции декомпозиции (`breakdown_completed`), а не только в конце выполнения.

**ОБНОВЛЕНИЕ v1.1.1**: Исправлен порядок вызовов в `breakdownTaskRecursively` - теперь `breakdown_completed` отправляется СРАЗУ после создания subtasks, ДО рекурсивного разбиения. Это обеспечивает настоящее инкрементальное обновление дерева - каждый узел появляется в UI моментально после его создания.

**ОБНОВЛЕНИЕ v1.2**: Дерево задач теперь обновляется не только после декомпозиции, но и **во время выполнения задач**! UI показывает изменение статусов в реальном времени:
- `planned` → `in_progress` когда задача начинает выполняться
- `in_progress` → `completed` когда задача успешно завершена
- `in_progress` → `failed` если задача завершилась с ошибкой

**ОБНОВЛЕНИЕ v1.2.1**: Исправлена видимость глубоких уровней вложенности:
- Все уровни дерева теперь автоматически раскрываются (было: только первые 2)
- TaskProgressMessage теперь использует **последнее** обновление дерева (было: первое)
- Добавлено логирование для отладки обновлений дерева

**ОБНОВЛЕНИЕ v2.0**: Критический архитектурный рефакторинг TaskOrchestrator:
- **Контекстно-ориентированное выполнение**: Родительские задачи теперь ВЫПОЛНЯЮТСЯ с контекстом из подзадач
- **Эффективная декомпозиция**: Supervisor решает нужна ли декомпозиция на каждом уровне
- **Накопление контекста**: Результаты подзадач передаются родительской задаче
- **Меньше затрат**: Декомпозиция только когда необходима, не "всё до атомов"
- См. подробности в [TASK_ORCHESTRATOR_V2_ARCHITECTURE.md](./TASK_ORCHESTRATOR_V2_ARCHITECTURE.md)

## Реализованные компоненты

### 1. TaskTreeView Component (`src/app/components/TaskTreeView.tsx`)

Новый компонент для отображения иерархического дерева задач с следующими возможностями:

#### Иконки для визуализации:

**Сложность задачи (TaskComplexity):**
- 🟢 `simple` - Простая задача
- 🟡 `medium`/`moderate` - Средняя задача
- 🔴 `complex` - Сложная задача

**Стратегия выполнения (ExecutionStrategy):**
- ➡️ `direct` - Прямое выполнение
- 📋 `flat` - Плоский workflow
- 🌳 `hierarchical` - Иерархическая декомпозиция

**Режим выполнения (ExecutionMode):**
- ⚡ `auto` - Автоматический выбор
- 📝 `plan` - Планирование
- ▶️ `execute` - Выполнение

**Решение супервизора (SupervisorDecision):**
- ✅ `approve` - Утверждено
- ✏️ `modify` - Модифицировано
- ❌ `reject` - Отклонено
- ↩️ `delegateBack` - Делегировано обратно

**Статус задачи (TaskStatus):**
- ⏳ `planned` - Запланировано
- 🔄 `in_progress` - Выполняется
- ✅ `completed` - Завершено
- ❌ `failed` - Ошибка
- 🚫 `blocked` - Заблокировано

#### Функциональность:

- **Иерархическое отображение**: Древовидная структура с отступами и линиями связи
- **Expand/Collapse**: Клик на задачу раскрывает/скрывает подзадачи
- **Автоматическое раскрытие**: Первые 2 уровня раскрываются автоматически
- **Визуальные подсказки**: 
  - Цветовая индикация статуса (синий для in_progress, зеленый для completed, красный для failed)
  - Hover-эффекты для интерактивности
  - Подсветка активной задачи
- **Информация о задаче**:
  - ID задачи
  - Описание
  - Результат выполнения
  - Ошибки (если есть)
  - Количество подзадач
- **Легенда**: Объяснение всех иконок внизу компонента

### 2. Обновлённый TaskProgressMessage (`src/app/components/TaskProgressMessage.tsx`)

Интегрирован компонент TaskTreeView:

- **Новый пропс**: `hierarchicalBreakdown?: any` - начальное дерево задач
- **Состояние**: `taskTree` - текущее состояние дерева задач
- **Обновление в реальном времени**: 
  - Извлекает hierarchicalBreakdown из progress updates через SSE
  - Автоматически обновляет дерево при получении новых данных
- **Отображение**: TaskTreeView встроен в TaskProgressMessage после прогресс-бара

### 3. IntelligentSupervisor Updates (`src/app/api/supervisor/unified/intelligentSupervisor.ts`)

Все три стратегии выполнения теперь возвращают hierarchicalBreakdown:

#### Direct Strategy (простые задачи):
```typescript
const taskTree = {
  taskId: 'task-root',
  description: request.taskDescription,
  status: 'completed',
  complexity: 'simple',
  executionStrategy: 'direct',
  result: execution.nextResponse,
  subtasks: [],
};
```

#### Flat Strategy (средние задачи):
```typescript
const taskTree = {
  taskId: 'task-root',
  description: request.taskDescription,
  status: 'completed',
  complexity: 'medium',
  executionStrategy: 'flat',
  result: execution.nextResponse,
  subtasks: workflowSteps.map((step, idx) => ({
    taskId: `task-root.${idx}`,
    description: step,
    status: 'completed',
    complexity: 'simple',
    result: step,
  })),
};
```

#### Hierarchical Strategy (сложные задачи):
```typescript
// Использует полное дерево задач из TaskOrchestrator
hierarchicalBreakdown: report.hierarchicalBreakdown
```

**Важно**: hierarchicalBreakdown теперь включается в progress updates через SSE:
```typescript
this.emitProgress('step_completed', message, progress, {
  ...otherDetails,
  hierarchicalBreakdown: taskTree,
});
```

## Поток данных

### Инкрементальные обновления (v1.1):

1. **TaskOrchestrator** → При каждой `breakdown_completed` отправляет текущее состояние rootTask
2. **IntelligentSupervisor callback** → Перехватывает `breakdown_completed` и строит hierarchicalBreakdown
3. **Progress Emitter (SSE)** → Отправляет обновление с hierarchicalBreakdown в details
4. **useTaskProgress hook** → Получает SSE обновления и сохраняет в updates array
5. **TaskProgressMessage** → Извлекает hierarchicalBreakdown из каждого обновления
6. **TaskTreeView** → Немедленно отображает обновлённое дерево задач

### Последовательность событий (v1.2 - с выполнением):

```
1. breakdown_started (task-root) → UI: "⏳ Декомпозиция началась"
2. breakdown_completed (task-root) → UI: дерево с подзадачами ⏳ planned
   🔴 task-root
   ├─ ⏳ task-root.0: "Найти участников"
   └─ ⏳ task-root.1: "Отправить приглашения"

3. breakdown_started (task-root.0) → UI: "⏳ Декомпозиция подзадачи"
4. breakdown_completed (task-root.0) → UI: обновлённое дерево
   🔴 task-root
   ├─ 🟡 task-root.0: "Найти участников"
   │  ├─ ⏳ task-root.0.0: "Поиск в календаре"
   │  └─ ⏳ task-root.0.1: "Поиск в почте"
   └─ ⏳ task-root.1: "Отправить приглашения"

5. task_started (task-root.0.0) → UI: статус меняется на 🔄 in_progress
   🔴 task-root
   ├─ 🟡 task-root.0: "Найти участников"
   │  ├─ 🔄 task-root.0.0: "Поиск в календаре"  ← ВЫПОЛНЯЕТСЯ!
   │  └─ ⏳ task-root.0.1: "Поиск в почте"
   └─ ⏳ task-root.1: "Отправить приглашения"

6. task_completed (task-root.0.0) → UI: статус меняется на ✅ completed
   🔴 task-root
   ├─ 🟡 task-root.0: "Найти участников"
   │  ├─ ✅ task-root.0.0: "Поиск в календаре"  ← ГОТОВО!
   │  └─ ⏳ task-root.0.1: "Поиск в почте"
   └─ ⏳ task-root.1: "Отправить приглашения"

7. ... продолжается для каждой задачи
```

Пользователь **видит всё в реальном времени**: построение дерева, начало выполнения, завершение каждой задачи!

## Типы данных

```typescript
export interface TaskNode {
  taskId: string;
  description: string;
  status: TaskStatus;
  complexity?: TaskComplexity;
  executionStrategy?: ExecutionStrategy;
  executionMode?: ExecutionMode;
  supervisorDecision?: SupervisorDecision;
  result?: string;
  error?: string;
  subtasks?: TaskNode[];
  level?: number;
}
```

## Примеры использования

### 1. Простая задача (Direct)
```
📊 Иерархия задач
└─ 🟢 ➡️ ✅ task-root: "Прочитай последнее письмо"
   └─ Результат: "Последнее письмо от Анны..."
```

### 2. Средняя задача (Flat)
```
📊 Иерархия задач
└─ 🟡 📋 ✅ task-root: "Прочитай письмо от Анны и назначь встречу"
   ├─ ✅ task-root.0: "Прочёл письмо от Анны..."
   └─ ✅ task-root.1: "Создал встречу на 15 января в 15:00..."
```

### 3. Сложная задача (Hierarchical)
```
📊 Иерархия задач
└─ 🔴 🌳 ✅ task-root: "Найди всех участников проекта и отправь приглашения"
   ├─ ✅ task-root.0: "Найти всех участников проекта Восток"
   │  ├─ ✅ task-root.0.0: "Поиск в календаре..."
   │  └─ ✅ task-root.0.1: "Поиск в почте..."
   └─ ✅ task-root.1: "Отправить приглашения всем участникам"
      ├─ ✅ task-root.1.0: "Отправлено приглашение Иванову..."
      └─ ✅ task-root.1.1: "Отправлено приглашение Петрову..."
```

## UI/UX особенности

### Цветовая кодировка:
- **Синий фон** (`bg-blue-50`) - Задача выполняется (in_progress)
- **Зелёный фон** (`bg-green-50`) - Задача завершена (completed)
- **Красный фон** (`bg-red-50`) - Ошибка выполнения (failed)
- **Серый фон** (`bg-gray-100`) - Hover-эффект

### Интерактивность:
- **Клик на задачу** - Раскрыть/скрыть подзадачи
- **▶/▼ индикатор** - Показывает состояние (свёрнуто/развёрнуто)
- **Tooltip на иконках** - Всплывающие подсказки при наведении

### Адаптивность:
- Автоматическое раскрытие первых 2 уровней для удобства
- Бесконечная вложенность поддерживается
- Плавные анимации переходов

## Тестирование

Для тестирования используйте intelligentSupervisorTool с разными типами задач:

1. **Простая задача**: "Прочитай последнее письмо"
2. **Средняя задача**: "Прочитай письмо от Анны и назначь встречу"
3. **Сложная задача**: "Найди всех участников проекта Восток и отправь им приглашения на встречу"

## Обратная совместимость

✅ Полная обратная совместимость:
- Если hierarchicalBreakdown не предоставлен, показывается заглушка
- Существующий функционал TaskProgressMessage сохранён
- Прогресс-бар и сообщения работают как прежде

## Будущие улучшения

1. **Инкрементальное обновление**: Строить дерево постепенно из orchestrator updates
2. **Фильтрация**: Показывать только failed/in_progress задачи
3. **Статистика**: Общее количество задач, время выполнения каждой
4. **Экспорт**: Сохранить дерево задач в JSON/текст
5. **Визуализация зависимостей**: Показывать связи между задачами

## Технические детали

### Производительность:
- Рекурсивный рендеринг оптимизирован
- Минимум ре-рендеров через useState
- Легковесные иконки (emoji)

### Доступность:
- Keyboard navigation (будущее улучшение)
- Screen reader support через title атрибуты
- Контрастные цвета для читаемости

### Отладка:
- Development mode показывает sessionId
- Console.log для отслеживания обновлений
- Подробные TypeScript типы

## Файлы изменений

### Новые файлы:
- `src/app/components/TaskTreeView.tsx` - Основной компонент дерева задач

### Изменённые файлы (v1.0):
- `src/app/components/TaskTreeView.tsx` - Основной компонент визуализации дерева
- `src/app/components/TaskProgressMessage.tsx` - Интеграция TaskTreeView
- `src/app/api/supervisor/unified/intelligentSupervisor.ts` - Генерация hierarchicalBreakdown для всех стратегий

### Изменённые файлы (v1.1 - Incremental Updates):
- `src/app/api/supervisor/taskOrchestrator.ts`:
  - Добавлены поля `task` и `rootTask` в `ProgressCallback`
  - Добавлено приватное поле `rootTask` в класс `TaskOrchestrator`
  - Модифицирован `breakdown_completed` callback - теперь передаёт полное дерево
  - **v1.1.1**: Исправлен порядок в `breakdownTaskRecursively` - сначала создаются все subtasks, затем отправляется `breakdown_completed`, и только потом запускается рекурсия
  - **v1.2**: Добавлены `task` и `rootTask` в callbacks для `task_started`, `task_completed`, `task_failed`
- `src/app/api/supervisor/unified/intelligentSupervisor.ts`:
  - Обновлён callback в `executeHierarchical()` для обработки `breakdown_completed`
  - При `breakdown_completed` строится и отправляется hierarchicalBreakdown через SSE
  - **v1.2**: Callback теперь обрабатывает также `task_started`, `task_completed`, `task_failed` и отправляет обновлённое дерево для каждого события

### Изменённые файлы (v1.2.1 - Fixed deep nesting):
- `src/app/components/TaskTreeView.tsx`:
  - Изменён `useState(true)` вместо `useState(depth < 2)` - все уровни раскрываются автоматически
  - Добавлен `useEffect` для автоматического раскрытия при появлении новых subtasks
  - Добавлено debug-логирование для отслеживания рендеринга узлов
- `src/app/components/TaskProgressMessage.tsx`:
  - Исправлен поиск дерева: теперь используется **последнее** обновление (reverse iteration)
  - Добавлено логирование обновлений дерева для отладки

### Изменённые файлы (v2.0 - Architecture Refactoring):
- `src/app/api/supervisor/taskOrchestrator.ts` - **КРИТИЧЕСКИЙ РЕФАКТОРИНГ**:
  - Новый метод `executeTaskRecursively()` - выполняет задачи рекурсивно с накоплением контекста
  - Новый метод `executeTaskDirectly()` - выполняет задачу с контекстом из подзадач
  - Метод `executeComplexTask()` упрощён - теперь только вызывает `executeTaskRecursively()`
  - Старые методы `breakdownTaskRecursively()`, `executeTasksInOrder()` помечены как @deprecated
  - **Ключевое изменение**: Родительские задачи теперь ВЫПОЛНЯЮТСЯ с результатами подзадач
  - См. детали в [TASK_ORCHESTRATOR_V2_ARCHITECTURE.md](./TASK_ORCHESTRATOR_V2_ARCHITECTURE.md)

### Без изменений (уже поддерживали):
- `src/app/hooks/useTaskProgress.ts` - SSE подписка и обновления
- `src/app/contexts/TranscriptContext.tsx` - Управление TASK_PROGRESS items
- `src/app/components/Transcript.tsx` - Рендеринг TaskProgressMessage
- `src/app/api/supervisor/unified/route.ts` - API endpoint
- `src/app/api/supervisor/unified/progressEmitter.ts` - SSE emitter

## Технические детали v1.1

### Критическое исправление v1.1.1 - Правильный порядок вызовов:

**ДО (неправильно):**
```typescript
// Create subtasks
for (let i = 0; i < subtaskDescriptions.length; i++) {
  // Создаём subtask
  task.subtasks.push(subtask);
  
  // ❌ СРАЗУ рекурсивно разбиваем - блокирует UI обновление!
  await this.breakdownTaskRecursively(subtask, taskTree, ...);
}

// ❌ Отправляем breakdown_completed только после ВСЕЙ рекурсии
this.notifyProgress({ type: 'breakdown_completed', ... });
```

**ПОСЛЕ (правильно):**
```typescript
// Create all subtasks first (without recursion)
for (let i = 0; i < subtaskDescriptions.length; i++) {
  task.subtasks.push(subtask);
  // НЕ вызываем рекурсию здесь!
}

// ✅ СРАЗУ отправляем breakdown_completed - UI видит новые subtasks!
this.notifyProgress({ 
  type: 'breakdown_completed',
  task: task,        // С новыми subtasks
  rootTask: this.rootTask  // Полное дерево
});

// ✅ ЗАТЕМ рекурсивно разбиваем каждую subtask
for (const subtask of task.subtasks) {
  await this.breakdownTaskRecursively(subtask, taskTree, ...);
}
```

**Результат:** Теперь каждый узел появляется в UI **моментально** после его создания, а не после того как все его дети рекурсивно разбиты!

### Изменения v1.2 - Обновления статусов выполнения:

**В TaskOrchestrator (`executeSingleTask`):**

```typescript
// При запуске задачи
task.status = 'in_progress';
this.notifyProgress({
  type: 'task_started',
  taskId: task.id,
  taskDescription: task.description,
  progress: TaskManager.calculateProgress(taskTree),
  task: task,
  rootTask: this.rootTask,  // ← Полное дерево для UI
});

// При успешном завершении
task.status = 'completed';
task.result = response.result;
this.notifyProgress({
  type: 'task_completed',
  task: task,
  rootTask: this.rootTask,  // ← Обновлённое дерево
});

// При ошибке
task.status = 'failed';
task.error = response.error;
this.notifyProgress({
  type: 'task_failed',
  task: task,
  rootTask: this.rootTask,  // ← Дерево с failed статусом
});
```

**В IntelligentSupervisor (callback):**

```typescript
// Обрабатываем ВСЕ важные события
if (update.rootTask && (
  update.type === 'breakdown_completed' || 
  update.type === 'task_started' || 
  update.type === 'task_completed' || 
  update.type === 'task_failed'
)) {
  // Строим hierarchicalBreakdown из актуального rootTask
  const hierarchicalBreakdown = this.buildHierarchicalBreakdown(update.rootTask);
  
  // Отправляем через SSE с user-friendly сообщениями
  const messages = {
    'breakdown_completed': `Декомпозиция завершена: ${update.taskDescription}`,
    'task_started': `Начато выполнение: ${update.taskDescription}`,
    'task_completed': `Завершено: ${update.taskDescription}`,
    'task_failed': `Ошибка: ${update.taskDescription}`,
  };
  
  this.emitProgress('step_started', messages[update.type], progress, {
    hierarchicalBreakdown,  // ← UI получает актуальное дерево!
    eventType: update.type,
  });
}
```

**Результат:** UI получает обновлённое дерево на каждом этапе:
- Декомпозиция → узлы появляются
- Начало выполнения → статус 🔄
- Завершение → статус ✅ или ❌

### Изменения в TaskOrchestrator:

```typescript
export type ProgressCallback = (update: {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'breakdown_started' | 'breakdown_completed';
  taskId: string;
  taskDescription: string;
  progress: number;
  currentTask?: string;
  result?: string;
  task?: Task;           // ← НОВОЕ: Текущая задача с подзадачами
  rootTask?: Task;       // ← НОВОЕ: Полное дерево для UI
}) => void;
```

При каждом `breakdown_completed`:
```typescript
this.notifyProgress({
  type: 'breakdown_completed',
  taskId: task.id,
  taskDescription: task.description,
  progress: TaskManager.calculateProgress(taskTree),
  task: task,              // Задача которая была декомпозирована
  rootTask: this.rootTask, // Полное дерево от корня
});
```

### Изменения в IntelligentSupervisor:

```typescript
(update) => {
  if (update.type === 'breakdown_completed' && update.rootTask) {
    // Строим hierarchicalBreakdown из rootTask
    const hierarchicalBreakdown = this.buildHierarchicalBreakdown(update.rootTask);
    
    // Отправляем через SSE
    this.emitProgress('step_started', message, progress, {
      orchestratorUpdate: update,
      hierarchicalBreakdown,        // ← Полное дерево в UI!
      breakdownCompleted: true,
      taskId: update.taskId,
    });
  }
}
```

## Преимущества инкрементальных обновлений (v1.2)

✅ **Полная визуальная обратная связь**: Пользователь видит и декомпозицию, и выполнение в реальном времени  
✅ **Прозрачность**: Понятно какая задача выполняется прямо сейчас  
✅ **Отладка**: Сразу видно где задача "застряла" (долго в in_progress)  
✅ **UX**: Нет ощущения "зависания" - постоянное обновление статусов  
✅ **Масштабируемость**: Для очень сложных задач виден прогресс на каждом этапе  
✅ **Статус-трекинг**: Видно какие задачи завершены (✅), какие выполняются (🔄), какие провалились (❌)

## Пример работы

Для задачи: "Найди всех участников проекта Восток и отправь приглашения"

**Шаг 1** (breakdown_completed task-root):
```
🔴 🌳 ⏳ task-root: "Найти участников и отправить приглашения"
├─ ⏳ task-root.0: "Найти всех участников проекта Восток"
└─ ⏳ task-root.1: "Отправить приглашения найденным участникам"
```

**Шаг 2** (breakdown_completed task-root.0):
```
🔴 🌳 ⏳ task-root: "Найти участников и отправить приглашения"
├─ 🟡 📋 ⏳ task-root.0: "Найти всех участников проекта Восток"
│  ├─ ⏳ task-root.0.0: "Поиск в календаре Google"
│  └─ ⏳ task-root.0.1: "Поиск в почте Gmail"
└─ ⏳ task-root.1: "Отправить приглашения найденным участникам"
```

**Шаг 3** (breakdown_completed task-root.1):
```
🔴 🌳 ⏳ task-root: "Найти участников и отправить приглашения"
├─ 🟡 📋 🔄 task-root.0: "Найти всех участников проекта Восток"
│  ├─ 🔄 task-root.0.0: "Поиск в календаре Google"
│  └─ ⏳ task-root.0.1: "Поиск в почте Gmail"
└─ 🟡 📋 ⏳ task-root.1: "Отправить приглашения найденным участникам"
   ├─ ⏳ task-root.1.0: "Отправить приглашение Иванову И.И."
   ├─ ⏳ task-root.1.1: "Отправить приглашение Петрову П.П."
   └─ ⏳ task-root.1.2: "Отправить приглашение Сидорову С.С."
```

И так далее - дерево **растёт в реальном времени**!

## Заключение

Реализация предоставляет **полную живую визуализацию** процесса работы IntelligentSupervisor в реальном времени, позволяя пользователям видеть:

### 🌳 Построение дерева (v1.1 + v1.1.1):
- ✅ Каждый узел появляется **моментально** после декомпозиции
- ✅ Дерево "растёт" в реальном времени, уровень за уровнем
- ✅ Видна структура задач ДО начала выполнения

### ⚡ Выполнение задач (v1.2):
- ✅ Переход статусов `planned` → `in_progress` → `completed`/`failed`
- ✅ Видно какая задача выполняется **прямо сейчас** (🔄)
- ✅ Видно какие задачи завершены (✅) и какие провалились (❌)
- ✅ Результаты отображаются для каждой задачи

### 📊 Полная прозрачность:
- ✅ Сложность каждой задачи (🟢 🟡 🔴)
- ✅ Стратегия выполнения (➡️ 📋 🌳)
- ✅ Иерархическая структура с любой глубиной вложенности
- ✅ Ошибки с описанием проблемы

### 🎯 UX преимущества:
- ✅ **Нет "чёрного ящика"** - весь процесс прозрачен
- ✅ **Нет зависаний** - всегда видно что система работает
- ✅ **Легко отлаживать** - сразу видно где проблема
- ✅ **Вовлечённость** - пользователь видит как AI "думает"

Это создаёт **беспрецедентную прозрачность** работы AI-агента и значительно улучшает пользовательский опыт! 🚀

