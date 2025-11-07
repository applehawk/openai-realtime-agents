# Ревью агентных взаимодействий и вызовов

**Дата:** 2025-01-27  
**Фокус:** Агентные взаимодействия, особенно в контексте проектов  
**Версия архитектуры:** v3.0

---

## Executive Summary

Проведен анализ архитектуры агентных взаимодействий с акцентом на работу с проектами. Выявлены **критические проблемы** в делегировании сложных задач и **несоответствия** в архитектуре.

### Ключевые находки:

1. ⚠️ **КРИТИЧНО**: ProjectAgent не имеет доступа к backend агентам (IntelligentSupervisor)
2. ⚠️ **ПРОБЛЕМА**: Отсутствие механизма делегирования сложных задач из ProjectAgent
3. ⚠️ **ДОКУМЕНТАЦИЯ**: ProjectAgent не упомянут в основной архитектурной документации
4. ✅ **ХОРОШО**: RouterAgent правильно настроен с delegateToIntelligentSupervisor
5. ✅ **ХОРОШО**: IntelligentSupervisor имеет адаптивную оценку сложности (v3.2)

---

## 1. Архитектурный анализ

### 1.1. Текущая структура агентов

```
Router Agent (RealtimeAgent)
├─ handoff → Knowledge Agent ✅
├─ handoff → Interview Agent ✅
├─ handoff → Project Agent ✅
├─ tool → delegateToIntelligentSupervisor ✅
└─ tool → MCP Server ✅

Project Agent (RealtimeAgent)
├─ tool → projectWizard ✅
├─ tool → getProjectByName ✅
├─ tool → createProject ✅
├─ tool → updateProject ✅
├─ tool → deleteProject ✅
├─ tool → searchProjects ✅
└─ tool → getAllProjects ✅
❌ НЕТ доступа к delegateToIntelligentSupervisor
❌ НЕТ доступа к backend агентам
```

### 1.2. Проблема: ProjectAgent не может обрабатывать сложные задачи

**Сценарий проблемы:**

```
User: "Найди всех участников проекта Восток и отправь им приглашения на встречу"

Текущий flow:
1. Router Agent → handoff → Project Agent
2. Project Agent получает запрос
3. Project Agent НЕ МОЖЕТ вызвать delegateToIntelligentSupervisor (нет доступа)
4. Project Agent может только:
   - Использовать projectWizard (для простых операций)
   - Использовать базовые MCP tools (getProjectByName, searchProjects)
5. ❌ НЕ МОЖЕТ выполнить сложную задачу с множеством шагов
```

**Ожидаемое поведение:**
- Project Agent должен либо:
  - Иметь доступ к `delegateToIntelligentSupervisor`
  - Или возвращать управление Router Agent для делегирования

**Текущее поведение:**
- Project Agent застревает, не может выполнить задачу

---

## 2. Детальный анализ взаимодействий

### 2.1. Router Agent → Project Agent (handoff)

**Реализация:**
```typescript:27:37:src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts
export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // Handoffs к специализированным RealtimeAgents (автоматический возврат)
  handoffs: [
    knowledgeAgent,    // ← Делегация для RAG поиска
    interviewAgent,    // ← Делегация для персонализации
    projectAgent,      // ← Делегация для управления проектами
  ],
```

**Статус:** ✅ Работает корректно

**Механизм возврата:**
```typescript:34:36:src/app/agentConfigs/severstalAssistantAgent/agents/projectAgent.ts
export function setProjectAgentHandoff(routerAgent: RealtimeAgent) {
  projectAgent.handoffs = [routerAgent];
}
```

**Статус:** ✅ Настроен правильно

---

### 2.2. Project Agent → Backend Agents

**Проблема:** Project Agent НЕ ИМЕЕТ доступа к backend агентам

**Текущие инструменты Project Agent:**
```typescript:14:32:src/app/agentConfigs/severstalAssistantAgent/agents/projectAgent.ts
export const projectAgent = new RealtimeAgent({
  name: 'projectAgent',
  handoffDescription: 'Агент для управления проектами: создание, обновление статуса, получение информации',
  instructions: projectAgentPrompt,
  tools: [
    // Пошаговые сценарии (мастер)
    projectWizard,

    // Базовые операции MCP
    getProjectByName,
    createProject,
    updateProject,
    updateProjectField,
    deleteProject,
    searchProjects,
    getAllProjects,
  ],
  voice: 'alloy',
});
```

**Что отсутствует:**
- ❌ `delegateToIntelligentSupervisor` - для сложных многошаговых задач
- ❌ `getTaskContext` - для отслеживания прогресса задач

**Сравнение с Router Agent:**
```typescript:57:61:src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts
    // Backend agent для всех многошаговых задач
    delegateToIntelligentSupervisor, // ← Unified intelligent supervisor (Path 4)
    
    // Task context для получения состояния выполняемых задач
    getTaskContext, // ← Получить состояние задачи по sessionId
```

**Вывод:** Project Agent ограничен только простыми операциями с проектами.

---

### 2.3. Router Agent → IntelligentSupervisor

**Реализация:**
```typescript:24:88:src/app/agentConfigs/severstalAssistantAgent/tools/intelligentSupervisorTool.ts
export const delegateToIntelligentSupervisor = tool({
  name: 'delegateToIntelligentSupervisor',
  description: `
Делегирует сложные задачи унифицированному интеллектуальному supervisor-агенту с адаптивной оценкой сложности.

**НОВОЕ (v3.2): Улучшенная делегация с единой оценкой**
- Supervisor делает ОДНУ оценку вместо двух (экономия ~300 tokens)
- Уровень 'tooSimple' для задач, которые primary agent может выполнить сам
- Даже 2-7 последовательных шагов могут быть tooSimple (если нет сложной логики)
- Если задача сложная (simple/medium/complex) → supervisor выполнит её сам
```

**Статус:** ✅ Реализовано правильно

**Механизм работы:**
1. Router Agent вызывает `delegateToIntelligentSupervisor`
2. IntelligentSupervisor оценивает сложность (tooSimple/simple/medium/complex)
3. Если tooSimple → возвращает guidance для primary agent
4. Если simple/medium/complex → выполняет задачу сам
5. Возвращает результат с workflowSteps

---

## 3. Проблемные сценарии

### 3.1. Сценарий 1: Сложная задача через Project Agent

**Запрос пользователя:**
> "Найди всех участников проекта Восток, проверь их календари на следующую неделю, найди общее свободное время и создай встречу"

**Текущий flow:**
```
User → Router Agent
     ↓ [handoff]
     Project Agent
     ↓ [пытается выполнить]
     ❌ НЕ МОЖЕТ - нет delegateToIntelligentSupervisor
     ↓ [возврат в Router Agent?]
     ❓ Неясно, как Project Agent должен вернуть управление для сложной задачи
```

**Ожидаемый flow:**
```
User → Router Agent
     ↓ [handoff]
     Project Agent
     ↓ [определяет сложность]
     ↓ [handoff обратно в Router Agent ИЛИ вызывает delegateToIntelligentSupervisor]
     Router Agent / IntelligentSupervisor
     ↓ [выполняет задачу]
     ↓ [возврат результата]
     Project Agent / Router Agent
     ↓ [озвучивает результат]
```

**Проблема:** Project Agent не имеет механизма для делегирования сложных задач.

---

### 3.2. Сценарий 2: Простая задача через Project Agent

**Запрос пользователя:**
> "Создай проект с названием 'Восток'"

**Текущий flow:**
```
User → Router Agent
     ↓ [handoff]
     Project Agent
     ↓ [использует projectWizard]
     ↓ [создаёт проект через MCP]
     ✅ Успешно
     ↓ [возврат в Router Agent]
     ✅ Работает корректно
```

**Статус:** ✅ Работает правильно для простых задач

---

### 3.3. Сценарий 3: Сложная задача через Router Agent

**Запрос пользователя:**
> "Найди всех участников проекта Восток и отправь им приглашения"

**Текущий flow:**
```
User → Router Agent
     ↓ [определяет сложность]
     ↓ [вызывает delegateToIntelligentSupervisor]
     IntelligentSupervisor
     ↓ [оценивает: complex]
     ↓ [выполняет иерархическую декомпозицию]
     ↓ [возвращает результат]
     Router Agent
     ↓ [озвучивает результат]
     ✅ Успешно
```

**Статус:** ✅ Работает правильно

---

## 4. Анализ промптов

### 4.1. Project Agent Prompt

```typescript:1:14:src/app/agentConfigs/severstalAssistantAgent/prompts/projectPrompt.ts
export const projectAgentPrompt = `
Ты — Project Agent. Помогаешь пользователю:
1) Добавить проект (мастер с уточняющими вопросами)
2) Обновить статус проекта
3) Показать информацию и статус проекта

Правила:
- Если пользователь говорит «Хочу добавить проект» — запускай мастер projectWizard в режиме create.
- Если «Обнови статус проект(а) …» — запускай projectWizard в режиме update_status. Если не хватает данных (имя/статус) — задавай уточняющие вопросы.
- Если «Покажи проект …» или «Статус проекта …» — используй projectWizard в режиме get_info.
- Сохраняй дружелюбный, деловой тон. Пошагово, один вопрос за раз.
- Если мастер завершён — подтверди результат (ID, название, статус).

Форматируем результат кратко и структурированно. Если MCP возвращает "Project not found" — предложи создать проект или уточнить имя.`;
```

**Проблемы:**
1. ❌ Нет инструкций по обработке сложных задач
2. ❌ Нет упоминания о делегировании в Router Agent
3. ❌ Нет упоминания о backend агентах
4. ❌ Ограничен только простыми операциями (create, update_status, get_info)

**Рекомендация:** Добавить раздел о делегировании сложных задач.

---

### 4.2. Router Agent Prompt

**Анализ routing logic:**
```typescript:227:239:src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts
## Routing Logic (Пути выполнения)

У вас есть 4 пути выполнения задач:

### Path 1: Direct MCP Tools
...
### Path 2: Knowledge Agent (handoff)
...
### Path 3: Interview Agent (handoff)
...
### Path 4: Intelligent Supervisor (сложные задачи) ⭐
```

**Проблема:** ❌ Нет упоминания о Project Agent в routing logic!

**Decision Matrix:**
```typescript:360:373:src/app/agentConfigs/severstalAssistantAgent/prompts/routerPrompt.ts
## Decision Matrix (Выбор пути)

**Алгоритм:**

1. ПОЛУЧЕН ЗАПРОС ПОЛЬЗОВАТЕЛЯ
2. Это новый пользователь? → ДА → Path 3: Interview Agent (handoff)
3. Это вопрос о прошлом/истории? → ДА → Path 2: Knowledge Agent (handoff)
4. Это одно простое действие? → ДА → Path 1: Direct MCP Tools
5. Множественные шаги (2+) или неуверен? → ДА → Path 4: Intelligent Supervisor ⭐
```

**Проблема:** ❌ Нет проверки "Это запрос о проекте?" перед делегированием в Project Agent.

**Рекомендация:** Добавить Path для Project Agent в routing logic.

---

## 5. Документация

### 5.1. README.md

**Проблема:** Project Agent не упомянут в основной архитектуре:

```markdown:13:20:src/app/agentConfigs/severstalAssistantAgent/README.md
```
Router Agent (центральное управление)
├─ handoff → Knowledge Agent → [exit criteria] → return to Router
├─ handoff → Interview Agent → [exit criteria] → return to Router
├─ tool call → Planning Agent (backend) → [response] → return to Router
├─ tool call → Complex Task Agent (backend) → [response] → return to Router
└─ direct call → MCP Server (n8n.cloud) → [response] → return to Router
```
```

**Отсутствует:**
- ❌ `├─ handoff → Project Agent → [exit criteria] → return to Router`

**Рекомендация:** Обновить README.md с включением Project Agent.

---

## 6. Рекомендации

### 6.1. КРИТИЧНО: Добавить доступ к backend агентам в Project Agent

**Вариант 1: Добавить delegateToIntelligentSupervisor в Project Agent**

```typescript
// src/app/agentConfigs/severstalAssistantAgent/agents/projectAgent.ts
import { delegateToIntelligentSupervisor } from '../tools/intelligentSupervisorTool';
import { getTaskContext } from '../tools/getTaskContextTool';

export const projectAgent = new RealtimeAgent({
  name: 'projectAgent',
  handoffDescription: 'Агент для управления проектами: создание, обновление статуса, получение информации',
  instructions: projectAgentPrompt,
  tools: [
    // Пошаговые сценарии (мастер)
    projectWizard,

    // Базовые операции MCP
    getProjectByName,
    createProject,
    updateProject,
    updateProjectField,
    deleteProject,
    searchProjects,
    getAllProjects,
    
    // Backend агенты для сложных задач
    delegateToIntelligentSupervisor, // ← ДОБАВИТЬ
    getTaskContext, // ← ДОБАВИТЬ
  ],
  voice: 'alloy',
});
```

**Преимущества:**
- ✅ Project Agent может обрабатывать сложные задачи напрямую
- ✅ Не нужно возвращаться в Router Agent
- ✅ Более прямой flow для пользователя

**Недостатки:**
- ⚠️ Дублирование инструментов между Router Agent и Project Agent
- ⚠️ Project Agent становится более сложным

---

**Вариант 2: Явное возвращение в Router Agent для сложных задач**

Обновить промпт Project Agent:

```typescript
export const projectAgentPrompt = `
Ты — Project Agent. Помогаешь пользователю:
1) Добавить проект (мастер с уточняющими вопросами)
2) Обновить статус проекта
3) Показать информацию и статус проекта

**ВАЖНО: Обработка сложных задач**
- Если задача требует множественных шагов (2+), условной логики, или работы с несколькими источниками данных:
  1. Скажи: "Это сложная задача, передаю её главному ассистенту"
  2. Верни управление Router Agent (через handoff)
  3. Router Agent обработает задачу через IntelligentSupervisor

Правила:
- Если пользователь говорит «Хочу добавить проект» — запускай мастер projectWizard в режиме create.
- Если «Обнови статус проект(а) …» — запускай projectWizard в режиме update_status.
- Если «Покажи проект …» — используй projectWizard в режиме get_info.
- Если задача сложная (множественные шаги, условная логика) — верни управление Router Agent.
...
`;
```

**Преимущества:**
- ✅ Четкое разделение ответственности
- ✅ Router Agent остается единой точкой для сложных задач
- ✅ Project Agent остается простым

**Недостатки:**
- ⚠️ Дополнительный hop (Project Agent → Router Agent → IntelligentSupervisor)
- ⚠️ Может быть менее интуитивным для пользователя

---

**Рекомендация:** **Вариант 1** (добавить delegateToIntelligentSupervisor в Project Agent)

**Обоснование:**
- Пользователь уже находится в контексте Project Agent
- Прямое делегирование более эффективно
- Соответствует принципу "агент должен уметь обрабатывать все задачи в своей области"

---

### 6.2. Обновить промпт Project Agent

Добавить раздел о сложных задачах:

```typescript
export const projectAgentPrompt = `
Ты — Project Agent. Помогаешь пользователю:
1) Добавить проект (мастер с уточняющими вопросами)
2) Обновить статус проекта
3) Показать информацию и статус проекта
4) Выполнять сложные операции с проектами (через IntelligentSupervisor)

**Обработка сложных задач:**
- Если задача требует множественных шагов (2+), условной логики, или работы с несколькими источниками:
  1. Используй delegateToIntelligentSupervisor для делегирования
  2. Передай полное описание задачи в taskDescription
  3. Включи контекст проекта в conversationContext
  4. Используй результат (nextResponse) дословно

**Примеры сложных задач:**
- "Найди всех участников проекта и отправь им приглашения"
- "Проверь календари участников проекта и найди общее время"
- "Проанализируй статусы всех проектов и составь отчёт"

Правила:
- Если пользователь говорит «Хочу добавить проект» — запускай мастер projectWizard в режиме create.
- Если «Обнови статус проект(а) …» — запускай projectWizard в режиме update_status.
- Если «Покажи проект …» — используй projectWizard в режиме get_info.
- Если задача сложная — используй delegateToIntelligentSupervisor.
...
`;
```

---

### 6.3. Обновить Router Agent Prompt

Добавить Path для Project Agent:

```typescript
## Routing Logic (Пути выполнения)

У вас есть 5 путей выполнения задач:

### Path 1: Direct MCP Tools
...

### Path 2: Knowledge Agent (handoff)
...

### Path 3: Interview Agent (handoff)
...

### Path 4: Project Agent (handoff) ⭐ НОВОЕ
**Когда делегировать:**
✅ Запросы о проектах (создание, обновление, получение информации)
✅ Простые операции с проектами
✅ Пошаговые сценарии (мастер)

**Примеры:**
- «Создай проект Восток» → [handoff → Project Agent]
- «Покажи статус проекта» → [handoff → Project Agent]
- «Обнови статус проекта» → [handoff → Project Agent]

**ВАЖНО:** Project Agent может сам делегировать сложные задачи через IntelligentSupervisor.

### Path 5: Intelligent Supervisor (сложные задачи) ⭐
...
```

Обновить Decision Matrix:

```typescript
## Decision Matrix (Выбор пути)

**Алгоритм:**

1. ПОЛУЧЕН ЗАПРОС ПОЛЬЗОВАТЕЛЯ
2. Это новый пользователь? → ДА → Path 3: Interview Agent (handoff)
3. Это вопрос о прошлом/истории? → ДА → Path 2: Knowledge Agent (handoff)
4. Это запрос о проекте? → ДА → Path 4: Project Agent (handoff)
5. Это одно простое действие? → ДА → Path 1: Direct MCP Tools
6. Множественные шаги (2+) или неуверен? → ДА → Path 5: Intelligent Supervisor ⭐
```

---

### 6.4. Обновить README.md

Добавить Project Agent в архитектуру:

```markdown
## Архитектура

```
Router Agent (центральное управление)
├─ handoff → Knowledge Agent → [exit criteria] → return to Router
├─ handoff → Interview Agent → [exit criteria] → return to Router
├─ handoff → Project Agent → [exit criteria] → return to Router
├─ tool call → Intelligent Supervisor (backend) → [response] → return to Router
└─ direct call → MCP Server (n8n.cloud) → [response] → return to Router
```

### Frontend RealtimeAgents (gpt-4o-realtime-mini)

1. **Router Agent** (`agents/routerAgent.ts`)
   ...

2. **Knowledge Agent** (`agents/knowledgeAgent.ts`)
   ...

3. **Interview Agent** (`agents/interviewAgent.ts`)
   ...

4. **Project Agent** (`agents/projectAgent.ts`) ⭐ НОВОЕ
   - Специалист по управлению проектами
   - Создание, обновление, получение информации о проектах
   - Пошаговые сценарии (мастер)
   - Делегирование сложных задач через IntelligentSupervisor
   - Промпт: `prompts/projectPrompt.ts`
```

---

## 7. План действий

### Приоритет 1 (КРИТИЧНО)

1. ✅ Добавить `delegateToIntelligentSupervisor` в Project Agent
2. ✅ Добавить `getTaskContext` в Project Agent
3. ✅ Обновить промпт Project Agent с инструкциями по сложным задачам

### Приоритет 2 (ВАЖНО)

4. ✅ Обновить Router Agent Prompt с Path для Project Agent
5. ✅ Обновить Decision Matrix в Router Agent Prompt
6. ✅ Обновить README.md с включением Project Agent

### Приоритет 3 (ЖЕЛАТЕЛЬНО)

7. ✅ Добавить тестовые сценарии для сложных задач через Project Agent
8. ✅ Обновить документацию по архитектуре
9. ✅ Добавить примеры использования в README.md

---

## 8. Метрики успеха

После внедрения изменений проверить:

1. ✅ Project Agent может обрабатывать сложные задачи (2+ шага)
2. ✅ Project Agent корректно делегирует в IntelligentSupervisor
3. ✅ Результаты возвращаются пользователю через Project Agent
4. ✅ Router Agent правильно роутит запросы о проектах в Project Agent
5. ✅ Документация обновлена и соответствует реализации

---

## 9. Заключение

**Текущее состояние:**
- ✅ Базовая архитектура агентов работает корректно
- ✅ Router Agent правильно настроен
- ✅ IntelligentSupervisor реализован хорошо
- ❌ Project Agent ограничен простыми операциями
- ❌ Отсутствует механизм обработки сложных задач в Project Agent

**Критическая проблема:**
Project Agent не может обрабатывать сложные многошаговые задачи, что ограничивает его функциональность.

**Рекомендуемое решение:**
Добавить `delegateToIntelligentSupervisor` в Project Agent для прямой обработки сложных задач в контексте проектов.

---

**End of Review**

