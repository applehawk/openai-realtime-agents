# Финальная архитектура декомпозиции SeverstalAssistant

## Критические инсайты

### 1. Email/Calendar - это MCP Server (внешний сервис)
- ✅ Вся логика email/calendar живёт на `rndaibot.app.n8n.cloud`
- ✅ Промпт агента только управляет **вызовами** MCP tools
- ❌ **НЕ нужно** выделять Email/Calendar в отдельные RealtimeAgents

### 2. Planning и Complex Task - это Backend Agents (не просто tools)
- ✅ `planningAgent` - полноценный **Agent** на базе gpt-4o (в `/api/supervisor/agent.ts`)
- ✅ `complexTaskAgent` - полноценный **TaskOrchestrator** (в `/api/tasks/execute`)
- ✅ Они работают через API и имеют собственную логику выполнения
- ✅ Это **не просто tools**, а **backend агенты с промптами и инструментами**

---

## Финальная архитектура

### Структура системы

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (RealtimeAgents)                   │
└─────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│ Router Agent │      │Knowledge Agent│    │Interview Agent│
│ (RealtimeAgent)│    │(RealtimeAgent)│    │(RealtimeAgent)│
│              │      │              │     │              │
│• Маршрутизация│     │• RAG поиск   │     │• Персонализ. │
│• MCP calls   │      │• История     │     │• Опрос       │
│• Делегация   │      │• Документы   │     │• Профиль     │
└──────┬───────┘      └──────────────┘     └──────────────┘
       │
       │ Tool calls (fetch API)
       │
┌──────▼──────────────────────────────────────────────────┐
│                BACKEND (Agents)                          │
└──────────────────────────────────────────────────────────┘
       │
       ├─────────────────────┬──────────────────────┐
       │                     │                      │
       ▼                     ▼                      ▼
┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│Planning Agent│     │Complex Task  │      │  MCP Server  │
│  (Agent)     │     │   Agent      │      │  (External)  │
│              │     │(TaskOrchestrator)   │              │
│• gpt-4o      │     │              │      │• n8n.cloud   │
│• Multi-step  │     │• 8+ steps    │      │• Gmail API   │
│• 2-7 steps   │     │• Hierarchical│      │• Calendar API│
│• /api/       │     │• /api/tasks/ │      │              │
│  supervisor  │     │  execute     │      │              │
└──────────────┘     └──────────────┘      └──────────────┘
```

---

## Компоненты системы

### Frontend: 3 RealtimeAgents

#### 1. Router Agent (Главный)

**Роль:** Главный голосовой помощник, маршрутизатор запросов

**Тип:** `RealtimeAgent` (gpt-4o-realtime-mini)

**Ответственность:**
- ✅ Определение намерения пользователя
- ✅ Прямые вызовы MCP tools (email/calendar)
- ✅ Делегация в Knowledge Agent для RAG (handoff)
- ✅ Делегация в Interview Agent для персонализации (handoff)
- ✅ Вызов Planning Agent через tool (API call)
- ✅ Вызов Complex Task Agent через tool (API call)

**Промпт:** ~300 строк

**Инструменты:**
```typescript
export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // Прямые MCP tools
  tools: [
    // Email/Calendar MCP Server (внешний сервис)
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),

    // User info и interview
    getCurrentUserInfo,
    checkInterviewStatus,

    // Tools для делегации backend агентам (через API)
    delegateToSupervisor,      // → /api/supervisor (Planning Agent)
    executeComplexTask,        // → /api/tasks/execute (Complex Task Agent)
  ],

  // Handoffs к специализированным RealtimeAgents
  handoffs: [
    knowledgeAgent,    // RAG поиск
    interviewAgent,    // Персонализация
  ],
});
```

---

#### 2. Knowledge Agent (RAG поиск)

**Роль:** Специалист по поиску знаний

**Тип:** `RealtimeAgent` (gpt-4o-realtime-mini)

**Ответственность:**
- ✅ Семантический поиск в базе знаний
- ✅ Исторический контекст
- ✅ Поиск в документах, заметках, старых письмах

**Промпт:** ~130 строк

**Инструменты:**
```typescript
export const knowledgeAgent = new RealtimeAgent({
  name: 'knowledgeAgent',
  handoffDescription: 'Специалист по поиску информации в базе знаний, документах, истории',
  instructions: knowledgeAgentPrompt,
  tools: [
    lightragQuery,
    lightragQueryData,
    lightragTrackStatus,
    lightragGetPipelineStatus,
  ],
});
```

---

#### 3. Interview Agent (Персонализация)

**Роль:** Специалист по персонализации

**Тип:** `RealtimeAgent` (gpt-4o-realtime-mini)

**Ответственность:**
- ✅ Проверка статуса интервью
- ✅ Проведение опроса (4 + 3 вопроса)
- ✅ Сохранение в профиль

**Промпт:** ~110 строк

**Инструменты:**
```typescript
export const interviewAgent = new RealtimeAgent({
  name: 'interviewAgent',
  handoffDescription: 'Специалист по персонализации: проведение интервью для новых пользователей',
  instructions: interviewAgentPrompt,
  tools: [
    getCurrentUserInfo,
    startInitialInterview,
    conductInitialInterview,
  ],
});
```

---

### Backend: 2 Agents

#### 4. Planning Agent (Supervisor)

**Роль:** Многошаговые задачи с логикой

**Тип:** **Backend `Agent`** (gpt-4o) - НЕ RealtimeAgent!

**Расположение:** `/api/supervisor/agent.ts`

**Ответственность:**
- ✅ Многошаговые задачи (2-7 шагов)
- ✅ Условная логика ("если X, то Y, иначе Z")
- ✅ Анализ и координация
- ✅ Принятие решений (approve/modify/reject/delegateBack)

**Промпт:** ~550 строк (детальный supervisor prompt)

**Реализация:**

```typescript
// src/app/api/supervisor/agent.ts
import { Agent } from '@openai/agents';
import { hostedMcpTool } from '@openai/agents';

export const supervisorAgent = new Agent({
  name: 'SupervisorAgent',
  model: 'gpt-4o',  // ← Более умная модель!
  instructions: supervisorAgentInstructions,
  tools: [
    // Calendar MCP для выполнения операций
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),
    // RAG MCP (через custom JSON-RPC)
  ],
});
```

**Tool для вызова из Router Agent:**

```typescript
// src/app/agentConfigs/severstalAssistantAgent/supervisorAgent.ts
export const delegateToSupervisor = tool({
  name: 'delegateToSupervisor',
  description: 'Делегирует сложные задачи backend supervisor agent (gpt-4o)',
  parameters: {
    type: 'object',
    properties: {
      conversationContext: { type: 'string' },
      proposedPlan: { type: 'string' },
      userIntent: { type: 'string' },
      complexity: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['conversationContext', 'proposedPlan', 'userIntent', 'complexity'],
  },
  execute: async (input) => {
    // Вызов backend Agent через API
    const response = await fetch('/api/supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();
    return result; // { decision, nextResponse, workflowSteps, ... }
  },
});
```

**API endpoint:**

```typescript
// src/app/api/supervisor/route.ts
import { supervisorAgent } from './agent';

export async function POST(request: Request) {
  const { conversationContext, proposedPlan, userIntent, complexity, history } = await request.json();

  // Запуск backend Agent
  const result = await supervisorAgent.run({
    input: {
      conversationContext,
      proposedPlan,
      userIntent,
      complexity,
    },
    history, // Контекст разговора
  });

  return Response.json(result);
}
```

**Возможности Planning Agent:**

1. **DelegateBack** - возврат простой задачи Router Agent
2. **Approve (EXECUTE IMMEDIATELY)** - выполнение 2-4 шагов сразу
3. **Approve (PLAN FIRST)** - составление плана для подтверждения (5+ шагов)
4. **Modify** - запрос уточнений у пользователя
5. **Reject** - отказ от небезопасной операции

---

#### 5. Complex Task Agent (TaskOrchestrator)

**Роль:** Иерархическое выполнение очень сложных задач

**Тип:** **Backend TaskOrchestrator** (система декомпозиции задач)

**Расположение:** `/api/tasks/execute`

**Ответственность:**
- ✅ Очень сложные задачи (8+ шагов)
- ✅ Массовые операции (множество людей)
- ✅ Рекурсивная декомпозиция на подзадачи
- ✅ Выполнение с учётом зависимостей
- ✅ Долгое выполнение (несколько минут)

**Архитектура:**

```typescript
// Иерархическая система выполнения задач
TaskOrchestrator
├─ Supervisor (gpt-4) - декомпозиция задачи
├─ Task Executor - выполнение подзадач
└─ Report Generator - сбор результатов

Пример:
Задача: "Найти участников, проверить календари, отправить приглашения"
    ↓
Декомпозиция на 3 подзадачи:
1. RAG: найти участников
2. Calendar: проверить доступность
3. Email: отправить приглашения
    ↓
Выполнение каждой подзадачи
    ↓
Сбор результатов
    ↓
Финальный отчёт
```

**Tool для вызова из Router Agent:**

```typescript
// src/app/agentConfigs/severstalAssistantAgent/executeComplexTaskTool.ts
export const executeComplexTask = tool({
  name: 'executeComplexTask',
  description: 'Выполнить ОЧЕНЬ СЛОЖНУЮ задачу через иерархическую систему (8+ шагов)',
  parameters: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'Полное описание ОЧЕНЬ сложной задачи (все детали)',
      },
      conversationContext: {
        type: 'string',
        description: 'Краткое резюме беседы с пользователем',
      },
    },
    required: ['taskDescription', 'conversationContext'],
  },
  execute: async (input) => {
    // Вызов backend TaskOrchestrator через API
    const response = await fetch('/api/tasks/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await response.json();
    return result; // { success, report, ... }
  },
});
```

**API endpoint:**

```typescript
// src/app/api/tasks/execute/route.ts
import { TaskOrchestrator } from './orchestrator';

export async function POST(request: Request) {
  const { taskDescription, conversationContext } = await request.json();

  const orchestrator = new TaskOrchestrator();

  // Запуск иерархического выполнения
  const result = await orchestrator.executeComplexTask({
    taskDescription,
    conversationContext,
  });

  return Response.json(result);
}
```

---

### External: MCP Server

#### Google Account MCP Server

**Роль:** Внешний сервис для email/calendar операций

**Тип:** Hosted MCP Server (n8n.cloud)

**Расположение:** `https://rndaibot.app.n8n.cloud/mcp/google_my_account`

**Содержит:**
- ✅ Интеграция с Gmail API
- ✅ Интеграция с Google Calendar API
- ✅ Аутентификация OAuth
- ✅ CRUD операции (read, send, create, update, delete)
- ✅ Обработка ошибок

**Доступ:**
```typescript
hostedMcpTool({
  serverLabel: 'calendar',
  serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
})
```

**ВАЖНО:** Это внешний сервис, вся логика живёт ТАМ, не в промпте агента!

---

## Потоки выполнения

### Поток 1: Простая задача (Direct MCP)

```
User: «Прочитай последнее письмо»
    ↓
Router Agent: «Открываю почту»
    ↓
[Вызов MCP Server: read_latest_email]
    ↓
MCP Server: { email data }
    ↓
Router Agent: «Последнее письмо от Ивана...»
```

**Участники:** Router Agent + MCP Server

---

### Поток 2: RAG поиск (Knowledge Agent handoff)

```
User: «Что писали о проекте Восток?»
    ↓
Router Agent [handoff → Knowledge Agent]
    ↓
Knowledge Agent: «Ищу в документах»
    ↓
[Вызов lightrag_query]
    ↓
Knowledge Agent: «Нашла три обсуждения...»
    ↓
[Автоматический возврат в Router Agent]
    ↓
Router Agent: [готов к следующему запросу]
```

**Участники:** Router Agent → Knowledge Agent → Router Agent

---

### Поток 3: Многошаговая задача (Planning Agent)

```
User: «Прочитай письмо от Анны и назначь встречу»
    ↓
Router Agent: «Секундочку, уточню детали»
    ↓
[Вызов delegateToSupervisor tool → API call]
    ↓
Backend Planning Agent (gpt-4o):
  1. Читает письмо через MCP
  2. Извлекает время встречи
  3. Проверяет календарь
  4. Создаёт событие
  5. Возвращает { nextResponse, workflowSteps }
    ↓
Router Agent: [использует nextResponse дословно]
Router Agent: «Я прочитал письмо от Анны... Встреча создана на среду в 15:00...»
```

**Участники:** Router Agent → Backend Planning Agent (через API) → Router Agent

---

### Поток 4: Очень сложная задача (Complex Task Agent)

```
User: «Найди всех участников проекта, проверь их календари, отправь приглашения»
    ↓
Router Agent: «Это очень сложная задача, может занять несколько минут. Продолжить?»
    ↓
User: «Да»
    ↓
Router Agent: «Работаю над задачей...»
    ↓
[Вызов executeComplexTask tool → API call]
    ↓
Backend Complex Task Agent (TaskOrchestrator):
  1. Декомпозирует задачу на 8+ подзадач
  2. Выполняет каждую подзадачу через:
     - RAG MCP (поиск участников)
     - Calendar MCP (проверка календарей)
     - Email MCP (отправка приглашений)
  3. Собирает результаты
  4. Генерирует отчёт
    ↓
[Через несколько минут]
    ↓
Router Agent: «Готово! Нашёл 8 участников, определил время, создал встречу, отправил приглашения. 7 из 8 доставлены успешно.»
```

**Участники:** Router Agent → Backend Complex Task Agent (через API) → Router Agent

---

### Поток 5: Персонализация (Interview Agent handoff)

```
[Новый пользователь подключается]
    ↓
Router Agent:
  [Вызов getCurrentUserInfo]
  [Вызов checkInterviewStatus(userId)]
    ↓
checkInterviewStatus: false (интервью не пройдено)
    ↓
Router Agent [handoff → Interview Agent]
    ↓
Interview Agent: «Могу провести краткий опрос на 3-5 минут?»
    ↓
User: «Да»
    ↓
Interview Agent:
  [Вызов startInitialInterview]
  [Задаёт 4 обязательных вопроса через conductInitialInterview]
  [Задаёт 3 опциональных вопроса]
  [Сохраняет в профиль]
    ↓
Interview Agent: «Спасибо! Предпочтения сохранены»
    ↓
[Автоматический возврат в Router Agent]
    ↓
Router Agent: [готов к задачам]
```

**Участники:** Router Agent → Interview Agent → Router Agent

---

## Сравнение: Неправильная vs Правильная архитектура

### ❌ Неправильная (из старой документации)

```
Frontend: 6 RealtimeAgents
├─ Router Agent
├─ Email Agent          ← Ненужный! Просто обёртка вокруг MCP
├─ Calendar Agent       ← Ненужный! Просто обёртка вокруг MCP
├─ Knowledge Agent
├─ Interview Agent
└─ Planning Agent       ← Неправильно! Это backend Agent, не RealtimeAgent

Backend: 1 Agent
└─ Complex Task Agent
```

**Проблемы:**
- ❌ Email/Calendar агенты - просто обёртки, нет логики
- ❌ Planning Agent неправильно представлен как frontend RealtimeAgent
- ❌ Лишние handoffs между Router → Email/Calendar
- ❌ Confusion между frontend и backend агентами

---

### ✅ Правильная (финальная)

```
Frontend: 3 RealtimeAgents
├─ Router Agent (с MCP tools внутри)
├─ Knowledge Agent (RAG логика)
└─ Interview Agent (персонализация)

Backend: 2 Agents
├─ Planning Agent (gpt-4o, многошаговые задачи)
└─ Complex Task Agent (TaskOrchestrator, 8+ шагов)

External: 1 Service
└─ MCP Server (n8n.cloud, email/calendar)
```

**Преимущества:**
- ✅ Router Agent напрямую работает с MCP (нет лишних агентов)
- ✅ Чёткое разделение: Frontend (RealtimeAgents) vs Backend (Agents)
- ✅ Planning и Complex Task правильно показаны как backend
- ✅ Меньше агентов = проще архитектура
- ✅ Правильная терминология

---

## Размеры промптов

### До (монолитный)
- **Один агент:** 733 строки

### После (декомпозированный)

**Frontend (RealtimeAgents):**
- Router Agent: ~300 строк
- Knowledge Agent: ~130 строк
- Interview Agent: ~110 строк
- **Итого Frontend:** 540 строк (↓ 26% от оригинала)

**Backend (Agents):**
- Planning Agent: ~550 строк (детальный supervisor prompt)
- Complex Task Agent: ~200 строк (orchestrator logic)
- **Итого Backend:** 750 строк

**Всего:** 1290 строк (↑ 76% от оригинала)

**Почему больше?**
- ✅ Backend агенты имеют **детальные** промпты с примерами
- ✅ Planning Agent содержит сложную логику принятия решений
- ✅ Разделение на frontend/backend требует дублирования контекста
- ✅ **Каждый агент фокусирован** на своей области (лучше качество)

**Выгоды:**
- ✅ Frontend агенты **легковесные** (300/130/110 строк)
- ✅ Backend агенты **мощные** (gpt-4o, детальные инструкции)
- ✅ Лучшее качество ответов (специализация)
- ✅ Легче поддерживать (модульность)

---

## Структура файлов

```
src/app/agentConfigs/severstalAssistantAgent/
├── index.ts (точка входа, feature flag)
│
├── agents/ (Frontend RealtimeAgents)
│   ├── routerAgent.ts (главный, с MCP tools)
│   ├── knowledgeAgent.ts (RAG)
│   └── interviewAgent.ts (персонализация)
│
├── prompts/ (Промпты для Frontend)
│   ├── routerPrompt.ts (~300 строк)
│   ├── knowledgePrompt.ts (~130 строк)
│   └── interviewPrompt.ts (~110 строк)
│
├── tools/ (Tools для Router Agent)
│   ├── supervisorAgent.ts (delegateToSupervisor tool)
│   ├── executeComplexTaskTool.ts (executeComplexTask tool)
│   ├── userInfoTool.ts
│   ├── interviewTools.ts
│   └── ragTools.ts
│
└── legacy/
    └── improvedPrompt.ts (старый монолитный, для rollback)

src/app/api/ (Backend Agents)
├── supervisor/
│   ├── route.ts (POST /api/supervisor)
│   └── agent.ts (Planning Agent: gpt-4o Agent)
│
└── tasks/
    ├── execute/
    │   └── route.ts (POST /api/tasks/execute)
    └── orchestrator.ts (Complex Task Agent: TaskOrchestrator)
```

---

## План миграции

### Этап 1: Подготовка (1 день)
- Создать структуру файлов
- Извлечь 3 промпта из монолитного (router, knowledge, interview)

### Этап 2: Frontend RealtimeAgents (2 дня)
- Router Agent (~300 строк + MCP tools + delegation tools)
- Knowledge Agent (~130 строк + RAG tools)
- Interview Agent (~110 строк + interview tools)

### Этап 3: Backend Agents (уже существуют!)
- Planning Agent - уже реализован в `/api/supervisor/agent.ts` ✅
- Complex Task Agent - уже реализован в `/api/tasks/execute` ✅

### Этап 4: Интеграция (1 день)
- Подключить Router Agent к backend агентам через tools
- Настроить handoffs (Knowledge, Interview)
- Feature flag для переключения

### Этап 5: Тестирование (2 дня)
- Unit тесты для каждого frontend агента
- Интеграционные тесты (Router → Backend)
- E2E тесты полных диалогов

### Этап 6: Деплой (1 день)
- Канареечный деплой (10% пользователей)
- Мониторинг метрик
- Rollback план

**Общее время:** 7 дней

---

## Метрики успеха

### Производительность
- **Frontend промпты:** ↓ 26% (540 vs 733 строк)
- **Скорость ответа:** Ожидается ↑ 20-30% (легковесные frontend агенты)
- **Latency handoffs:** < 200ms (Knowledge, Interview)
- **Latency backend calls:** 2-5 секунд (Planning, Complex Task)

### Качество
- **Точность маршрутизации:** Целевая 95%+
- **Успешность выполнения:** Ожидается ↑ 15-25%
- **Детальность ответов:** ↑ для сложных задач (backend gpt-4o)

### Разработка
- **Время добавления нового frontend агента:** 1-2 дня
- **Время изменения backend агента:** 0.5-1 день
- **Покрытие тестами:** Целевая 80%+

---

## Заключение

### Ключевые решения

1. **3 Frontend RealtimeAgents:**
   - Router Agent (с MCP tools внутри)
   - Knowledge Agent (RAG логика)
   - Interview Agent (персонализация)

2. **2 Backend Agents:**
   - Planning Agent (gpt-4o, многошаговые задачи)
   - Complex Task Agent (TaskOrchestrator, 8+ шагов)

3. **1 External Service:**
   - MCP Server (n8n.cloud, email/calendar)

### Почему это правильно?

1. **Email/Calendar не выделены:**
   - MCP Server - внешний сервис, нет логики в промпте
   - Router Agent напрямую вызывает MCP tools

2. **Planning и Complex Task - backend агенты:**
   - Не RealtimeAgents, а полноценные Backend Agents
   - Имеют собственные промпты и инструменты
   - Работают через API (fetch)

3. **Чёткое разделение:**
   - **Frontend:** Лёгкие RealtimeAgents для голосового интерфейса
   - **Backend:** Мощные Agents для сложной обработки
   - **External:** MCP Server для интеграций

### Преимущества

- ✅ Простая архитектура (3 frontend + 2 backend)
- ✅ Правильная терминология (RealtimeAgent vs Agent)
- ✅ Оптимальное использование моделей (mini для frontend, gpt-4o для backend)
- ✅ Масштабируемость (легко добавить новые агенты)
- ✅ Тестируемость (модульная структура)

### Следующие шаги

1. Создать структуру файлов
2. Извлечь промпты frontend агентов
3. Интегрировать с существующими backend агентами
4. Тестирование
5. Деплой с feature flag
6. Мониторинг и итерация
