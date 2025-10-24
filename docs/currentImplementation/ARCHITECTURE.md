# SeverstalAssistant - Архитектура системы

## Быстрый обзор

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (RealtimeAgents)                   │
│              gpt-4o-realtime-mini                        │
└─────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Router Agent    │
                    │     (300 стр)     │
                    │                   │
                    │  • Маршрутизация  │
                    │  • MCP calls      │
                    │  • Делегация      │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │ handoff             │ handoff             │ tool call
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│Knowledge Agent│     │Interview Agent│    │Backend Agents│
│   (130 стр)  │      │   (110 стр)  │     │              │
│              │      │              │     │ Planning     │
│• RAG поиск   │      │• Персонализ. │     │ Complex Task │
│• История     │      │• Опрос       │     │              │
└──────┬───────┘      └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │ возврат             │ возврат             │ возврат
       └─────────────────────┼─────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │  Router Agent   │
                    │ (управление)    │
                    └─────────────────┘
```

---

## Потоки с возвратом управления

### Поток 1: Простая задача (Direct MCP)
```
User: «Прочитай письмо»
    ↓
Router Agent [вызов MCP]
    ↓
MCP Server → ответ
    ↓
Router Agent → User
```
**Участники:** Router Agent + MCP Server
**Возврат:** Не требуется (Router Agent не делегировал)

---

### Поток 2: RAG поиск (Handoff → Return)
```
User: «Что писали о проекте?»
    ↓
Router Agent [анализирует запрос]
    ↓
Router Agent [handoff → Knowledge Agent]
    ↓
Knowledge Agent: «Ищу в документах»
    ↓
Knowledge Agent [вызов lightrag_query]
    ↓
Knowledge Agent: «Нашла три обсуждения...»
    ↓
Knowledge Agent [exit criteria → ВОЗВРАТ в Router Agent]
    ↓
Router Agent [управление возвращено]
    ↓
Router Agent [готов к следующему запросу]
```
**Участники:** Router Agent → Knowledge Agent → **Router Agent**

**Возврат:** Автоматический (SDK), после exit criteria

---

### Поток 3: Персонализация (Handoff → Return)
```
[Новый пользователь]
    ↓
Router Agent [checkInterviewStatus = false]
    ↓
Router Agent [handoff → Interview Agent]
    ↓
Interview Agent: «Могу провести опрос?»
    ↓
User: «Да»
    ↓
Interview Agent [проводит интервью 4+3 вопроса]
    ↓
Interview Agent: «Спасибо! Предпочтения сохранены»
    ↓
Interview Agent [exit criteria → ВОЗВРАТ в Router Agent]
    ↓
Router Agent [управление возвращено]
    ↓
Router Agent: «Чем могу помочь?»
```
**Участники:** Router Agent → Interview Agent → **Router Agent**

**Возврат:** Автоматический (SDK), после завершения интервью

---

### Поток 4: Многошаговая задача (Tool Call → Return)
```
User: «Прочитай письмо и создай встречу»
    ↓
Router Agent: «Секундочку, уточню детали»
    ↓
Router Agent [tool call → delegateToSupervisor]
    ↓
POST /api/supervisor
    ↓
Backend Planning Agent (gpt-4o):
  - Читает письмо (MCP)
  - Извлекает время
  - Создаёт встречу (MCP)
  - Формирует nextResponse
    ↓
Response: { nextResponse, workflowSteps }
    ↓
Router Agent [получает ответ от tool]
    ↓
Router Agent [использует nextResponse дословно]
    ↓
Router Agent: «Я прочитал письмо... Встреча создана...»
    ↓
Router Agent [готов к следующему запросу]
```
**Участники:** Router Agent → Backend Planning Agent → **Router Agent**

**Возврат:** Через response от tool (fetch API)

---

### Поток 5: Очень сложная задача (Tool Call → Return)
```
User: «Найди участников, проверь календари, отправь приглашения»
    ↓
Router Agent: «Это сложная задача, займёт несколько минут. Продолжить?»
    ↓
User: «Да»
    ↓
Router Agent [tool call → executeComplexTask]
    ↓
POST /api/tasks/execute
    ↓
Backend Complex Task Agent:
  - Декомпозирует задачу
  - Выполняет подзадачи (RAG, Calendar, Email MCP)
  - Собирает результаты
  - Генерирует отчёт
    ↓
Response: { success, report }
    ↓
Router Agent [получает ответ от tool]
    ↓
Router Agent: «Готово! Нашёл 8 участников, создал встречу...»
    ↓
Router Agent [готов к следующему запросу]
```
**Участники:** Router Agent → Backend Complex Task Agent → **Router Agent**

**Возврат:** Через response от tool (fetch API)

---

### Поток 6: Комбинированный (Multiple Handoffs)
```
User: «Покажи письма от Анны»
    ↓
Router Agent [прямой вызов MCP]
Router Agent: «Нашла три письма от Анны»
    ↓
User: «Что она писала о проекте Восток?»
    ↓
Router Agent [handoff → Knowledge Agent]
    ↓
Knowledge Agent: «Ищу в документах»
Knowledge Agent: «В переписке с Анной о проекте Восток нашла три обсуждения...»
    ↓
Knowledge Agent [ВОЗВРАТ → Router Agent]
    ↓
Router Agent [управление возвращено]
    ↓
User: «Назначь встречу с ней на следующую неделю»
    ↓
Router Agent [tool call → delegateToSupervisor]
    ↓
Backend Planning Agent: выполняет многошаговую задачу
    ↓
Router Agent [получает response]
Router Agent: «Когда удобно: понедельник, среду или пятницу?»
    ↓
[... продолжение диалога ...]
    ↓
Router Agent [готов к следующему запросу]
```
**Участники:** Router Agent → MCP → **Router Agent** → Knowledge Agent → **Router Agent** → Backend Planning Agent → **Router Agent**

**Ключевой момент:** Router Agent **ВСЕГДА возвращает управление** после каждой делегации

---

## Компоненты

### Frontend: 3 RealtimeAgents

| Агент | Тип | Модель | Промпт | Роль | Возврат в Router |
|-------|-----|--------|--------|------|------------------|
| **Router** | RealtimeAgent | gpt-4o-realtime-mini | 300 стр | Маршрутизация, MCP calls | N/A (главный) |
| **Knowledge** | RealtimeAgent | gpt-4o-realtime-mini | 130 стр | RAG поиск | ✅ Автоматический (exit criteria) |
| **Interview** | RealtimeAgent | gpt-4o-realtime-mini | 110 стр | Персонализация | ✅ Автоматический (exit criteria) |

### Backend: 2 Agents

| Агент | Тип | Модель | Промпт | Роль | Возврат в Router |
|-------|-----|--------|--------|------|------------------|
| **Planning** | Agent | gpt-4o | 550 стр | Многошаговые задачи (2-7 шагов) | ✅ Через response (tool) |
| **Complex Task** | TaskOrchestrator | gpt-4o | 200 стр | Иерархические задачи (8+ шагов) | ✅ Через response (tool) |

### External: 1 Service

| Сервис | Тип | Содержит | Возврат в Router |
|--------|-----|----------|------------------|
| **MCP Server** | Hosted MCP | Gmail API, Calendar API | ✅ Через response (MCP tool) |

---

## Механизмы возврата управления

### 1. Handoff Return (RealtimeAgents)

**Механизм:** Автоматический возврат через SDK

**Когда:** Knowledge Agent, Interview Agent завершают задачу

**Exit Criteria в промпте специализированного агента:**
```typescript
`
## Exit Criteria

После успешного выполнения задачи:
- Сообщить пользователю результат
- Автоматически вернуться к Router Agent
- НЕ задавать новые вопросы вне своей области

Примеры завершения:
- «Нашла три обсуждения проекта. Подробности?» [ждёт ответ]
- Если пользователь хочет действие (отправить письмо, создать встречу)
  → Автоматически вернуться к Router Agent

Эскалация:
- Если запрос выходит за рамки вашей области:
  → «Это не моя область»
  → Автоматически вернуться к Router Agent
`
```

**Как работает SDK:**
```typescript
// Router Agent регистрирует handoffs
const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  handoffs: [knowledgeAgent, interviewAgent],
  // ...
});

// SDK автоматически:
// 1. Определяет, когда Knowledge Agent завершил
// 2. Возвращает управление Router Agent
// 3. Router Agent продолжает разговор с пользователем
```

---

### 2. Tool Return (Backend Agents)

**Механизм:** Возврат через response от fetch API

**Когда:** Planning Agent, Complex Task Agent завершают задачу

**Как работает:**
```typescript
// Router Agent вызывает tool
const result = await delegateToSupervisor({
  conversationContext: '...',
  proposedPlan: '...',
  userIntent: '...',
  complexity: 'high',
});

// Backend Planning Agent выполняет задачу
// и возвращает:
{
  decision: 'approve',
  nextResponse: 'Я прочитал письмо от Анны... Встреча создана...',
  workflowSteps: ['Прочитал письмо', 'Создал событие', ...],
}

// Router Agent получает result
// и использует nextResponse дословно
Router Agent: [говорит nextResponse пользователю]

// Router Agent готов к следующему запросу
```

**Важно:** Backend агент НЕ имеет прямого доступа к голосовому интерфейсу. Он только возвращает **nextResponse**, который Router Agent озвучивает.

---

### 3. MCP Return

**Механизм:** Возврат через response от MCP tool

**Когда:** MCP Server возвращает данные

**Как работает:**
```typescript
// Router Agent вызывает MCP tool
const result = await hostedMcpTool.read_latest_email();

// MCP Server возвращает данные:
{
  from: 'Ivan',
  subject: 'Meeting',
  body: '...',
}

// Router Agent обрабатывает результат
Router Agent: «Последнее письмо от Ивана с темой "Meeting"...»

// Router Agent готов к следующему запросу
```

---

## Router Agent - центр управления

### Конфигурация

```typescript
export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // Handoffs к RealtimeAgents (автоматический возврат)
  handoffs: [
    knowledgeAgent,    // ← Делегация сюда, возврат автоматический
    interviewAgent,    // ← Делегация сюда, возврат автоматический
  ],

  // Tools для прямых вызовов и backend делегации
  tools: [
    // MCP Server (внешний сервис, возврат через response)
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),

    // User info
    getCurrentUserInfo,
    checkInterviewStatus,

    // Backend agents (возврат через response от fetch)
    delegateToSupervisor,      // ← Tool call, возврат через response
    executeComplexTask,        // ← Tool call, возврат через response
  ],
});
```

### Логика маршрутизации в промпте Router Agent

```typescript
`
## Routing Logic

### Когда использовать MCP tools (прямо):
✅ «Прочитай письмо» → read_email (MCP)
✅ «Покажи встречи» → get_calendar_events (MCP)
✅ «Отправь письмо» → send_email (MCP) [с подтверждением]

Возврат: Через response от MCP tool

---

### Когда делегировать Knowledge Agent (handoff):
✅ «Что писали о проекте?» → [handoff → Knowledge Agent]
✅ «Когда обсуждали бюджет?» → [handoff → Knowledge Agent]

Возврат: АВТОМАТИЧЕСКИЙ через SDK (после exit criteria)

После возврата:
- Router Agent продолжает разговор
- Готов к следующему запросу

---

### Когда делегировать Interview Agent (handoff):
✅ Новый пользователь (checkInterviewStatus = false)
✅ Пользователь просит персонализацию

Возврат: АВТОМАТИЧЕСКИЙ через SDK (после завершения интервью)

После возврата:
- Router Agent: «Чем могу помочь?»
- Готов к задачам

---

### Когда использовать Planning Agent (tool call):
✅ Множественные зависимые шаги (2-7)
✅ «Прочитай письмо И назначь встречу»
✅ Условная логика, анализ

Преамбула: «Секундочку, уточню детали»

Возврат: Через response от tool (nextResponse)

После получения response:
- Использовать nextResponse ДОСЛОВНО
- Готов к следующему запросу

---

### Когда использовать Complex Task Agent (tool call):
✅ 8+ шагов
✅ Массовые операции (множество людей)

ВАЖНО: Предупредить + получить подтверждение!

Возврат: Через response от tool (report)

После получения response:
- Озвучить результат из report
- Готов к следующему запросу
`
```

---

## Exit Criteria (для возврата в Router)

### Knowledge Agent Exit Criteria

```typescript
`
## Exit Criteria

После предоставления результатов RAG поиска:

1. Сообщить результат пользователю:
   - «Нашла три обсуждения...»
   - «Подробности?»

2. Если пользователь спрашивает детали по найденному:
   - Предоставить детали
   - Продолжить разговор

3. Если пользователь хочет ДЕЙСТВИЕ (отправить письмо, создать встречу):
   - «Передаю основному помощнику»
   - АВТОМАТИЧЕСКИ вернуться к Router Agent

4. Если запрос выходит за рамки RAG:
   - «Это не моя область»
   - АВТОМАТИЧЕСКИ вернуться к Router Agent

SDK автоматически вернёт управление Router Agent.
`
```

### Interview Agent Exit Criteria

```typescript
`
## Exit Criteria

После завершения интервью:

1. Сообщить результат:
   - «Спасибо! Я сохранил ваши предпочтения»
   - «Теперь буду учитывать их в работе»

2. АВТОМАТИЧЕСКИ вернуться к Router Agent

SDK автоматически вернёт управление Router Agent.
Router Agent продолжит: «Чем могу помочь?»
`
```

---

## Диаграмма полного цикла

```
┌─────────────────────────────────────────────┐
│          User                               │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│       Router Agent (центр управления)        │
│                                             │
│  Анализирует запрос:                        │
│  • Простая задача? → MCP                    │
│  • RAG? → Knowledge Agent                   │
│  • Персонализация? → Interview Agent        │
│  • Многошаговая? → Planning Agent           │
│  • Очень сложная? → Complex Task Agent      │
└─────┬───────┬───────┬───────┬───────┬───────┘
      │       │       │       │       │
      ▼       ▼       ▼       ▼       ▼
┌─────────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────┐
│  MCP    │ │Know│ │Intv│ │Plan│ │Complex │
│ Server  │ │ledge│ │view│ │ning│ │  Task  │
└─────┬───┘ └─┬──┘ └─┬──┘ └─┬──┘ └───┬────┘
      │       │      │      │        │
      │ resp  │ exit │ exit │ resp   │ resp
      │       │ crit │ crit │ (next  │ (report)
      │       │eria  │eria  │ Resp)  │
      ▼       ▼      ▼      ▼        ▼
┌─────────────────────────────────────────────┐
│       Router Agent (управление)             │
│                                             │
│  Получает управление обратно:               │
│  • От MCP: через response                   │
│  • От Knowledge: автоматически (SDK)        │
│  • От Interview: автоматически (SDK)        │
│  • От Planning: через response              │
│  • От Complex Task: через response          │
│                                             │
│  Готов к следующему запросу ✓               │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│          User (продолжение диалога)          │
└─────────────────────────────────────────────┘
```

---

## Ключевые принципы

### 1. Router Agent - единая точка входа/выхода

- ✅ Все запросы пользователя приходят в Router Agent
- ✅ Все ответы пользователю идут через Router Agent
- ✅ Специализированные агенты ВСЕГДА возвращают управление Router Agent

### 2. Два механизма возврата

**Handoff (RealtimeAgents):**
- Knowledge Agent → Router Agent (автоматический)
- Interview Agent → Router Agent (автоматический)
- Через exit criteria + SDK

**Tool Call (Backend Agents):**
- Planning Agent → Router Agent (через response)
- Complex Task Agent → Router Agent (через response)
- Через fetch API response

### 3. Router Agent координирует всю систему

```
Router Agent:
├─ Анализирует намерение пользователя
├─ Выбирает путь выполнения
├─ Делегирует специализированным агентам
├─ ПОЛУЧАЕТ УПРАВЛЕНИЕ ОБРАТНО
└─ Продолжает диалог с пользователем
```

---

## Документация

- 📄 **[agent-decomposition-final.md](./agent-decomposition-final.md)** - Детальная спецификация
- 📄 **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Этот файл (обзор с возвратом управления)

---

## Структура файлов

```
src/app/agentConfigs/severstalAssistantAgent/
├── agents/
│   ├── routerAgent.ts       # ← Центр управления
│   ├── knowledgeAgent.ts    # ← Возврат через exit criteria
│   └── interviewAgent.ts    # ← Возврат через exit criteria
├── prompts/
│   ├── routerPrompt.ts      # ← Логика маршрутизации
│   ├── knowledgePrompt.ts   # ← Exit criteria для возврата
│   └── interviewPrompt.ts   # ← Exit criteria для возврата
└── tools/
    ├── supervisorAgent.ts        # ← Возврат через response
    └── executeComplexTaskTool.ts # ← Возврат через response

src/app/api/
├── supervisor/
│   └── agent.ts             # ← Backend Planning Agent
└── tasks/
    └── orchestrator.ts      # ← Backend Complex Task Agent
```

---

**Последнее обновление:** 2025-10-23

**Версия:** 4.0 (с правильной схемой возврата управления в Router Agent)
