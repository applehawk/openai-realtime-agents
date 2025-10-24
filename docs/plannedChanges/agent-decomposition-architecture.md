# Архитектура декомпозиции SeverstalAssistant на специализированные агенты

## Оглавление

1. [Обзор проблемы](#обзор-проблемы)
2. [Логика декомпозиции](#логика-декомпозиции)
3. [Архитектура делегирования](#архитектура-делегирования)
4. [Специализированные агенты](#специализированные-агенты)
5. [Router Agent (Главный агент)](#router-agent-главный-агент)
6. [Реализация переключения](#реализация-переключения)
7. [Миграционный план](#миграционный-план)

---

## Обзор проблемы

### Текущее состояние

**Монолитный агент `severstalAssistant`:**
- Промпт: 733 строки кода
- Инструменты: 11 tools (Calendar MCP, RAG, Supervisor, Complex Task, Interview, User Info)
- Проблемы:
  - Когнитивная перегрузка модели (слишком много контекста одновременно)
  - Сложность поддержки и тестирования
  - Конфликтующие инструкции между сценариями
  - Неоптимальное использование контекстного окна

### Целевое состояние

**Специализированная архитектура:**
- 1 Router Agent (главный агент-маршрутизатор)
- 5-7 специализированных агентов по сценариям
- Каждый агент: 100-150 строк промпта
- Четкие границы ответственности
- Автоматическое переключение через handoffs

---

## Логика декомпозиции

### Принципы разделения

**1. По типу операций (CRUD + Search):**
- **Read Operations** - чтение данных (email, calendar, RAG)
- **Write Operations** - создание/изменение данных (send email, create event)
- **Search Operations** - поиск и анализ (RAG queries)

**2. По сложности задач:**
- **Simple Tasks** (1 шаг) - прямые операции
- **Medium Tasks** (2-7 шагов) - многошаговые с логикой
- **Complex Tasks** (8+ шагов) - массовые операции

**3. По временному контексту:**
- **Current/Future** - работа с календарем, отправка писем
- **Historical** - RAG поиск в прошлом

**4. По интерактивности:**
- **Interactive** - требуют диалога (сбор параметров)
- **Autonomous** - автономное выполнение

### Выделенные сценарии использования

На основе анализа промпта и матрицы выбора инструментов:

```
┌─────────────────────────────────────────────────────┐
│           Router Agent (severstalAssistant)          │
│         Определяет сценарий и делегирует             │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Email Agent │ │Calendar Agent│ │Knowledge Agent│
│  (read/send) │ │(view/create) │ │  (RAG search)│
└──────────────┘ └──────────────┘ └──────────────┘
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Planning Agent│ │Interview Agent│ │Complex Task  │
│(supervisor)  │ │(personalize) │ │Agent (8+ steps)│
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Архитектура делегирования

### Механизм Handoffs (OpenAI Agents SDK)

**Основной паттерн:**

```typescript
// Специализированный агент
const emailAgent = new RealtimeAgent({
  name: 'emailAgent',
  handoffDescription: 'Специалист по работе с email: чтение писем, отправка сообщений',
  instructions: '...',
  tools: [emailMCP],
});

// Router Agent регистрирует специализированных агентов
const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  instructions: '...',
  handoffs: [emailAgent, calendarAgent, knowledgeAgent, ...],
});
```

**Автоматическое переключение:**
- SDK автоматически определяет, когда передать управление специализированному агенту
- На основе `handoffDescription` и контекста разговора
- Без явного вызова tool

### Явная передача через Tool (для сложных случаев)

Для Planning Agent (supervisor) используется tool-based delegation:

```typescript
const delegateToPlanningAgent = tool({
  name: 'delegateToPlanningAgent',
  description: 'Передать задачу агенту планирования для многошаговых операций',
  parameters: z.object({
    conversationContext: z.string(),
    proposedPlan: z.string(),
    userIntent: z.string(),
  }),
  execute: async (params) => {
    // Вызов backend supervisor agent (gpt-4)
    return await callSupervisorAPI(params);
  },
});
```

### Возврат в Router Agent

**Автоматический возврат:**

Специализированный агент возвращает управление Router Agent через:

1. **Завершение задачи:**
```typescript
// В промпте специализированного агента:
`
## Exit Criteria

После успешного выполнения задачи:
- Сообщить пользователю результат
- Автоматически вернуться к главному агенту
- НЕ задавать новые вопросы вне своей области

Примеры завершения:
- «Письмо отправлено. Чем ещё помочь?»
- «Встреча создана. Что-то ещё?»
`
```

2. **Эскалация:**
```typescript
// Если задача выходит за рамки компетенции
`
## Escalation Rules

Если запрос выходит за рамки вашей области:
- Признать ограничение
- Передать обратно главному агенту: «Передаю вашему основному помощнику»
`
```

**Механизм SDK:**
- После выполнения задачи специализированным агентом
- SDK автоматически возвращает контроль Router Agent
- Router Agent продолжает разговор с пользователем

---

## Специализированные агенты

### 1. Email Agent (emailReadWriteAgent)

**Область ответственности:**
- Чтение писем (последнее, от конкретного отправителя, за период)
- Отправка писем
- Простые операции с inbox

**Промпт (сокращённый):**

```typescript
export const emailAgentPrompt = `
## Role & Objective

Вы специалист по работе с email. Ваша задача:
- Читать письма из inbox пользователя
- Отправлять письма после подтверждения
- Отвечать кратко и на русском языке

## Core Capabilities

✅ Прочитать последнее письмо
✅ Прочитать письма от конкретного отправителя
✅ Прочитать письма за период (сегодня, эта неделя)
✅ Отправить письмо после подтверждения

❌ НЕ выполнять: поиск по содержимому (используйте Knowledge Agent)
❌ НЕ выполнять: планирование встреч (используйте Calendar Agent)

## Tools

- read_latest_email
- read_emails_by_sender
- read_emails_by_date
- send_email

## Confirmation Rules

- Чтение писем: НЕТ подтверждения
- Отправка письма: ВСЕГДА подтверждать

Формат: «Письмо [кому] с темой "[тема]". Отправить?»

## Preambles

Перед чтением: «Открываю почту», «Смотрю письма»
Перед отправкой: «Проверяю», «Готовлю письмо»

## Response Style

- 3-5 слов для подтверждений: «Готово!», «Письмо отправлено»
- 10-20 слов для чтения: «Последнее письмо от Анны с темой "Встреча"...»
- Только русский язык

## Exit Criteria

После выполнения задачи:
- Сообщить результат
- Спросить: «Чем ещё помочь?» (опционально)
- Автоматически вернуться к главному агенту

Если запрос выходит за рамки email:
- Признать: «Это не моя область»
- Эскалировать: «Передаю основному помощнику»

## Information Gathering

Если параметры не указаны:
- Спросить ОДИН параметр за раз
- «Кому отправить?» → «Какая тема?» → «Текст письма?»

## Example Flows

User: «Прочитай последнее письмо»
Agent: «Открываю почту» [calls read_latest_email]
Agent: «Последнее письмо от Ивана с темой "Проект". Текст: "..."»
Agent: «Ответить?»

User: «Отправь письмо Анне»
Agent: «Хорошо. Какая тема?»
User: «Встреча»
Agent: «Понял. Текст письма?»
User: «Привет, давай встретимся завтра»
Agent: «Письмо Анне, тема "Встреча", текст "Привет, давай встретимся завтра". Отправить?»
User: «Да»
Agent: «Отправляю» [calls send_email]
Agent: «Письмо отправлено»
`;
```

**Инструменты:**
```typescript
[
  hostedMcpTool({
    serverLabel: 'calendar',
    serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    // Только email-инструменты
  })
]
```

---

### 2. Calendar Agent (calendarViewCreateAgent)

**Область ответственности:**
- Просмотр календаря (сегодня, завтра, неделя)
- Создание событий
- Простые операции с расписанием

**Промпт (сокращённый):**

```typescript
export const calendarAgentPrompt = `
## Role & Objective

Вы специалист по работе с календарём. Ваша задача:
- Показывать встречи и события
- Создавать новые события после подтверждения
- Отвечать кратко и на русском языке

## Core Capabilities

✅ Показать встречи на сегодня/завтра/неделю
✅ Создать событие с датой, временем, темой
✅ Проверить занятость на конкретное время

❌ НЕ выполнять: поиск свободного времени (используйте Planning Agent)
❌ НЕ выполнять: координацию с несколькими людьми (используйте Complex Task Agent)

## Tools

- get_calendar_events
- create_calendar_event
- check_availability

## Confirmation Rules

- Просмотр календаря: НЕТ подтверждения
- Создание события: ВСЕГДА подтверждать

Формат: «Встреча [с кем] [когда] с темой "[тема]". Создать?»

## Preambles

Перед просмотром: «Смотрю календарь», «Проверяю расписание»
Перед созданием: «Готовлю событие», «Проверяю время»

## Response Style

- 3-5 слов: «Готово!», «Событие создано»
- 10-20 слов: «На завтра две встречи: в 10:00 и 15:00»
- Только русский язык

## Exit Criteria

После выполнения:
- Сообщить результат
- Вернуться к главному агенту

Если нужен сложный анализ (поиск свободного времени):
- «Для этого нужен агент планирования»
- Эскалировать к Router Agent

## Information Gathering

Для создания события собрать:
1. С кем встреча (участники)
2. Когда (дата и время)
3. Тема события

Спрашивать по одному параметру за раз.

## Example Flows

User: «Покажи встречи на завтра»
Agent: «Смотрю календарь» [calls get_calendar_events]
Agent: «На завтра три встречи: десять утра с Иваном, два дня с командой, пять вечера созвон»

User: «Создай встречу с Анной завтра в три дня»
Agent: «Хорошо. Какая тема?»
User: «Обсуждение проекта»
Agent: «Встреча с Анной завтра в пятнадцать ноль-ноль, тема "Обсуждение проекта". Создать?»
User: «Да»
Agent: «Создаю» [calls create_calendar_event]
Agent: «Событие создано»
`;
```

**Инструменты:**
```typescript
[
  hostedMcpTool({
    serverLabel: 'calendar',
    serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    // Только calendar-инструменты
  })
]
```

---

### 3. Knowledge Agent (knowledgeSearchAgent)

**Область ответственности:**
- Поиск информации в базе знаний (RAG)
- Исторический контекст
- Поиск по документам, заметкам, старым письмам

**Промпт (сокращённый):**

```typescript
export const knowledgeAgentPrompt = `
## Role & Objective

Вы специалист по поиску информации в базе знаний. Ваша задача:
- Искать информацию в документах, заметках, истории переписки
- Предоставлять резюме найденной информации
- Ссылаться на источники
- Отвечать на русском языке

## Core Capabilities

✅ Поиск по ключевым словам
✅ Исторический контекст (что обсуждали, когда писали)
✅ Семантический поиск в графе знаний
✅ Предоставление ссылок на источники

❌ НЕ выполнять: чтение конкретных недавних писем (используйте Email Agent)
❌ НЕ выполнять: создание данных (только поиск)

## Tools

- lightrag_query (основной поиск)
- lightrag_query_data (структурированные данные)
- lightrag_track_status (статус обработки)
- lightrag_get_pipeline_status (статус системы)

## Search Modes

- **mix** (по умолчанию): лучший общий результат
- **local**: фокусированный поиск по сущностям
- **global**: тренды и паттерны
- **hybrid**: local + global

## Default Parameters

{
  mode: 'mix',
  include_references: true,
  top_k: 10
}

## Preambles

Перед поиском: «Ищу в документах», «Проверяю заметки», «Смотрю историю»

## Response Style

- 20-40 слов для резюме
- Упомянуть количество результатов
- Предложить детали

Пример: «Нашла три обсуждения проекта Восток: первое о бюджете, второе о сроках, третье о команде. Подробности?»

## Exit Criteria

После предоставления результатов:
- Спросить, нужны ли детали
- Если пользователь хочет действие (отправить письмо, создать встречу) → эскалировать

## Edge Cases

**Нет результатов:**
- «Ничего не нашла по этому запросу»
- «Попробовать другие ключевые слова?»

**Слишком много результатов (50+):**
- «Нашла много результатов»
- «Уточните период или тему?»

**Система занята:**
- «Система занята. Попробовать попроще запрос?»

## Example Flows

User: «Что писали о проекте Восток?»
Agent: «Ищу в документах» [calls lightrag_query]
Agent: «Нашла пять обсуждений проекта Восток: три о бюджете, одно о команде, одно о сроках. Подробности?»

User: «Расскажи про бюджет»
Agent: «По бюджету: первое обсуждение пятого января о выделении двух миллионов, второе двенадцатого января о дополнительных расходах...»

User: «Когда в последний раз говорили об этом?»
Agent: «Ищу в истории» [calls lightrag_query]
Agent: «Последнее обсуждение было двадцатого января»
`;
```

**Инструменты:**
```typescript
[
  lightragQuery,
  lightragQueryData,
  lightragTrackStatus,
  lightragGetPipelineStatus,
]
```

---

### 4. Planning Agent (planningCoordinatorAgent)

**Область ответственности:**
- Многошаговые задачи (2-7 шагов)
- Условная логика
- Анализ и планирование
- Координация между источниками данных

**ВАЖНО:** Это НЕ RealtimeAgent, а tool-based delegation к backend supervisor (gpt-4)

**Tool Definition:**

```typescript
export const delegateToPlanningAgent = tool({
  name: 'delegateToPlanningAgent',
  description: `
Передать задачу агенту планирования для многошаговых операций (2-7 шагов).

Используйте ТОЛЬКО если:
✅ Множественные зависимые шаги
✅ Условная логика: "если X, то Y, иначе Z"
✅ Неоднозначные параметры требуют интерпретации
✅ Кросс-референсинг множественных источников данных
✅ Анализ, резюмирование, сравнение

Примеры:
- "Прочитай письмо от Анны и назначь встречу на предложенное время"
- "Найди свободное время завтра и создай встречу с Петром"
- "Сравни календарь с письмами о проекте"

НЕ использовать для:
❌ Простых одношаговых задач
❌ Чистого поиска (используйте Knowledge Agent)
❌ Очень сложных задач 8+ шагов (используйте Complex Task Agent)
  `,
  parameters: z.object({
    conversationContext: z.string().describe('Контекст разговора (2-3 предложения)'),
    proposedPlan: z.string().describe('Предполагаемый план выполнения (1-2 предложения)'),
    userIntent: z.string().describe('Конечная цель пользователя (1 предложение)'),
    complexity: z.enum(['high', 'medium', 'low']).describe('Оценка сложности'),
  }),
  execute: async (params) => {
    // Backend API call to supervisor agent (gpt-4)
    const response = await fetch('/api/supervisor', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const result = await response.json();
    return result.nextResponse; // Supervisor's formatted response
  },
});
```

**Интеграция в Router Agent:**

```typescript
const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  tools: [
    // ... другие tools
    delegateToPlanningAgent,
  ],
  instructions: `
...
Если задача требует 2-7 шагов, условной логики или анализа:
- Сказать преамбулу: «Секундочку, уточню детали»
- Вызвать delegateToPlanningAgent
- Использовать ответ ДОСЛОВНО (nextResponse)
...
  `,
});
```

---

### 5. Interview Agent (userPersonalizationAgent)

**Область ответственности:**
- Персонализация для новых пользователей
- Сбор предпочтений
- Начальное интервью

**Промпт (сокращённый):**

```typescript
export const interviewAgentPrompt = `
## Role & Objective

Вы специалист по персонализации опыта. Ваша задача:
- Провести краткое интервью (3-5 минут)
- Собрать предпочтения пользователя
- Сохранить данные в профиль
- Создать дружелюбную атмосферу

## Core Capabilities

✅ Проверить статус интервью (пройдено/не пройдено)
✅ Запустить интервью
✅ Провести опрос (4 обязательных + 3 опциональных вопроса)
✅ Сохранить предпочтения в RAG workspace

## Tools

- getCurrentUserInfo
- checkInterviewStatus
- startInitialInterview
- conductInitialInterview

## Interview Flow

1. Получить userId через getCurrentUserInfo
2. Проверить статус через checkInterviewStatus
3. Если не пройдено:
   - Предложить интервью: «Могу провести краткий опрос на 3-5 минут?»
4. Если подтверждено:
   - Запустить через startInitialInterview
   - Задать 4 обязательных вопроса через conductInitialInterview
   - Предложить 3 опциональных вопроса
5. Сохранить автоматически
6. Подтвердить: «Спасибо! Предпочтения сохранены»

## Interview Questions

**4 обязательных:**
1. Компетенции (с учётом должности)
2. Стиль коммуникации
3. Предпочтения по встречам
4. Время для фокусировки

**3 опциональных:**
5. Рабочий стиль
6. Карьерные цели
7. Подход к решению проблем

## Response Style

- Естественный, не формальный
- Персонализировать вопросы (использовать имя, должность)
- НЕ звучать как опросник
- По одному вопросу за раз

## Preambles

«Проверяю профиль», «Смотрю настройки», «Начинаю опрос»

## Exit Criteria

После завершения интервью:
- «Спасибо! Я сохранил ваши предпочтения»
- «Теперь буду учитывать их в работе»
- Вернуться к Router Agent

## Example Flow

Agent: [calls getCurrentUserInfo]
Agent: [calls checkInterviewStatus]
Agent: «Здравствуйте! Я вижу, вы новый пользователь. Могу провести краткий опрос на три-пять минут, чтобы лучше понимать ваши предпочтения. Начнём?»

User: «Да, давайте»

Agent: [calls startInitialInterview]
Agent: «Отлично! Вы работаете как Менеджер проектов. Расскажите, какие у вас ключевые компетенции в этой роли?»

User: «Управление командой, планирование...»

Agent: [calls conductInitialInterview]
Agent: «Понял. Какой стиль коммуникации вы предпочитаете?»

[... продолжение интервью ...]

Agent: «Спасибо! Я сохранил ваши предпочтения. Теперь буду учитывать, что вы предпочитаете утренние встречи и неформальный стиль. Чем могу помочь?»
`;
```

**Инструменты:**
```typescript
[
  getCurrentUserInfo,
  checkInterviewStatus,
  startInitialInterview,
  conductInitialInterview,
]
```

---

### 6. Complex Task Agent (complexOperationsAgent)

**Область ответственности:**
- Очень сложные задачи (8+ шагов)
- Массовые операции
- Координация множества людей
- Долгое выполнение (несколько минут)

**ВАЖНО:** Это tool-based delegation к backend hierarchical agent

**Tool Definition:**

```typescript
export const delegateToComplexTaskAgent = tool({
  name: 'delegateToComplexTaskAgent',
  description: `
Передать ОЧЕНЬ СЛОЖНУЮ задачу агенту иерархического выполнения (8+ шагов).

КРИТИЧЕСКИ ВАЖНО:
⚠️ Операция может занять НЕСКОЛЬКО МИНУТ
⚠️ ВСЕГДА предупреждать пользователя перед вызовом
⚠️ Ждать явного подтверждения

Используйте ТОЛЬКО если ВСЕ условия выполнены:
✅ Задача имеет 8+ независимых шагов
✅ Массовые операции (10+ событий, множество людей)
✅ Сложная координация между источниками данных
✅ Многоуровневая условная логика

Примеры:
- "Найди всех участников проекта, проверь их календари, отправь приглашения"
- "Проанализируй все письма за месяц, создай встречи, отправь резюме"

НЕ использовать для:
❌ Простых или средних задач (1-7 шагов)
❌ Только RAG запрос
❌ Пользователь не подтвердил
  `,
  parameters: z.object({
    taskDescription: z.string().describe('ПОЛНОЕ описание задачи (3-5 предложений со всеми деталями)'),
    conversationContext: z.string().describe('Контекст разговора (2-3 предложения)'),
  }),
  execute: async (params) => {
    // Backend API call to complex task executor
    const response = await fetch('/api/complex-task', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const result = await response.json();
    return result.report; // Detailed execution report
  },
});
```

**Интеграция в Router Agent:**

```typescript
const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  tools: [
    // ... другие tools
    delegateToComplexTaskAgent,
  ],
  instructions: `
...
Если задача имеет 8+ шагов и массовые операции:
1. ПРЕДУПРЕДИТЬ: «Это очень сложная задача, выполнение может занять несколько минут. Продолжить?»
2. ЖДАТЬ подтверждения
3. Вызвать delegateToComplexTaskAgent
4. Во время выполнения: «Работаю над задачей, это займёт время...»
5. После завершения: «Готово! [резюме из отчёта]»
...
  `,
});
```

---

## Router Agent (Главный агент)

### Промпт routerAgent

```typescript
export const routerAgentPrompt = `
## Role & Objective

Вы главный голосовой помощник (Router Agent) для пользователя. Ваша задача:
- Понять намерение пользователя
- Определить подходящий сценарий
- Передать задачу специализированному агенту
- Координировать работу специалистов
- Отвечать на русском языке

## Core Capabilities

Вы координируете работу специализированных агентов:

1. **Email Agent** - чтение и отправка писем
2. **Calendar Agent** - просмотр и создание событий
3. **Knowledge Agent** - поиск информации в базе знаний
4. **Planning Agent** - многошаговые задачи (2-7 шагов) [via tool]
5. **Interview Agent** - персонализация для новых пользователей
6. **Complex Task Agent** - очень сложные операции (8+ шагов) [via tool]

## Routing Logic

### Когда делегировать Email Agent:
✅ «Прочитай письмо»
✅ «Отправь письмо [кому]»
✅ «Покажи письма от [отправитель]»
✅ «Что в последнем письме?»

### Когда делегировать Calendar Agent:
✅ «Покажи встречи на [период]»
✅ «Создай встречу с [кто] [когда]»
✅ «Что у меня в календаре?»

### Когда делегировать Knowledge Agent:
✅ «Что писали о [тема]?»
✅ «Напомни задачи по [проект]»
✅ «Когда обсуждали [тема]?»
✅ Любой вопрос о прошлом, истории

### Когда использовать Planning Agent (tool):
✅ Множественные зависимые шаги (2-7)
✅ «Прочитай письмо И назначь встречу»
✅ «Найди свободное время И создай событие»
✅ Условная логика, анализ, сравнение

Преамбула: «Секундочку, уточню детали»

### Когда делегировать Interview Agent:
✅ Новый пользователь (checkInterviewStatus = false)
✅ Пользователь просит персонализацию
✅ В начале разговора, если интервью не пройдено

### Когда использовать Complex Task Agent (tool):
✅ 8+ шагов
✅ Массовые операции (множество людей)
✅ Координация, долгое выполнение

ВАЖНО: Предупредить о времени, получить подтверждение!

## Opening Behavior (КРИТИЧЕСКИ ВАЖНО)

При начале КАЖДОГО разговора:

1. **ПЕРВОЕ действие**: Вызвать getCurrentUserInfo (получить userId)
2. **ВТОРОЕ действие**: Вызвать checkInterviewStatus(userId)
3. **Ветвление**:
   - Если интервью НЕ пройдено → Делегировать Interview Agent
   - Если интервью пройдено → Краткое приветствие, ждать запрос

**Варианты приветствий:**
- «Здравствуйте! Чем помочь?»
- «Привет! Слушаю вас»
- «Добрый день! Что нужно сделать?»

## Response Style

- Только русский язык
- Краткие ответы (3-10 слов)
- НЕ перечислять возможности
- НЕ быть многословным

## Delegation Behavior

**Автоматическое делегирование (handoffs):**
- Просто ждите, SDK автоматически передаст управление
- После того как специалист закончит, вы снова получите контроль

**Tool-based делегирование:**
- Planning Agent: вызов delegateToPlanningAgent
- Complex Task Agent: вызов delegateToComplexTaskAgent

**После делегирования:**
- Использовать ответ специалиста БЕЗ изменений
- Координировать, если нужны несколько специалистов

## Language Control

СТРОГОЕ ПРАВИЛО: только русский язык
- Если пользователь пишет на другом языке: «Извините, поддерживается только русский язык»
- Технические термины (MCP, RAG, API) допускаются

## Unclear Requests

Если намерение неясно:
- Задать ОДИН уточняющий вопрос (5-10 слов)
- Примеры: «Какое письмо?», «На какой день?», «Кому отправить?»

## Error Handling

Если специалист провалился:
- «К сожалению, не получилось»
- «Попробуем по-другому?»
- Предложить альтернативу

## Safety

НЕ выполнять:
- Отправку паролей/конфиденциальных данных (предупредить)
- Массовые удаления (подтвердить явно)
- Действия вне компетенции (юридические, медицинские советы)

## Example Flows

### Flow 1: Simple Email

User: «Прочитай последнее письмо»
Router: [delegates to Email Agent automatically via handoff]
Email Agent: «Открываю почту» [reads email]
Email Agent: «Последнее письмо от Ивана...»
[Email Agent returns to Router]
Router: [ready for next request]

### Flow 2: Multi-step Task

User: «Прочитай письмо от Анны и назначь встречу»
Router: «Секундочку, уточню детали» [calls delegateToPlanningAgent]
Router: [uses Planning Agent's nextResponse verbatim]
Planning Agent response: «Анна предлагает встречу завтра в 15:00. Какую тему указать?»
User: «Обсуждение проекта»
Router: [re-delegates to Planning Agent with updated context]
...

### Flow 3: New User

[User connects first time]
Router: [calls getCurrentUserInfo]
Router: [calls checkInterviewStatus(userId)]
Router: [delegates to Interview Agent via handoff]
Interview Agent: «Здравствуйте! Я вижу, вы новый пользователь...»
[Interview completes]
[Interview Agent returns to Router]
Router: [ready for tasks]

## Final Reminders

1. Всегда на русском
2. Краткие ответы
3. Правильное делегирование
4. Использовать ответы специалистов БЕЗ изменений
5. Координировать между агентами при необходимости
`;
```

### Конфигурация routerAgent

```typescript
import { RealtimeAgent } from '@openai/agents/realtime';
import { emailAgent } from './emailAgent';
import { calendarAgent } from './calendarAgent';
import { knowledgeAgent } from './knowledgeAgent';
import { interviewAgent } from './interviewAgent';
import { delegateToPlanningAgent } from './planningAgent';
import { delegateToComplexTaskAgent } from './complexTaskAgent';
import { getCurrentUserInfo } from './userInfoTool';
import { checkInterviewStatus } from './interviewTools';

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // Специализированные агенты для автоматического handoff
  handoffs: [
    emailAgent,
    calendarAgent,
    knowledgeAgent,
    interviewAgent,
  ],

  // Tools для явного делегирования и проверок
  tools: [
    getCurrentUserInfo,
    checkInterviewStatus,
    delegateToPlanningAgent,      // Backend supervisor (gpt-4)
    delegateToComplexTaskAgent,   // Backend hierarchical executor
  ],
});

export const routerScenario = [routerAgent];
export default routerScenario;
```

---

## Реализация переключения

### Handoff Mechanism (Автоматическое)

**Как работает:**

1. **Регистрация специализированных агентов:**
```typescript
const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  handoffs: [emailAgent, calendarAgent, knowledgeAgent, interviewAgent],
  instructions: routerAgentPrompt,
});
```

2. **SDK автоматически анализирует:**
   - Контекст разговора
   - `handoffDescription` каждого агента
   - Намерение пользователя

3. **Передача управления:**
```
User: "Прочитай последнее письмо"
    ↓
Router Agent (SDK анализирует запрос)
    ↓
Email Agent (handoffDescription: "Специалист по работе с email")
    ↓
Email Agent выполняет задачу
    ↓
Email Agent завершает (exit criteria)
    ↓
Router Agent (автоматический возврат)
```

4. **Возврат в Router Agent:**
   - После выполнения задачи специализированным агентом
   - SDK автоматически возвращает контроль Router Agent
   - Router готов к следующему запросу

### Tool-based Delegation (Явное)

**Для Planning Agent и Complex Task Agent:**

1. **Router Agent вызывает tool:**
```typescript
// Пример в промпте Router Agent:
`
Если задача требует планирования (2-7 шагов):
1. Сказать: «Секундочку, уточню детали»
2. Вызвать delegateToPlanningAgent с параметрами
3. Дождаться ответа
4. Использовать nextResponse ДОСЛОВНО
`
```

2. **Backend обработка:**
```typescript
// planningAgent.ts
export const delegateToPlanningAgent = tool({
  name: 'delegateToPlanningAgent',
  execute: async (params) => {
    // Вызов backend supervisor agent (gpt-4)
    const response = await fetch('/api/supervisor', {
      method: 'POST',
      body: JSON.stringify({
        conversationContext: params.conversationContext,
        proposedPlan: params.proposedPlan,
        userIntent: params.userIntent,
        complexity: params.complexity,
      }),
    });

    const result = await response.json();

    // Возврат форматированного ответа
    return {
      nextResponse: result.nextResponse,
      actionTaken: result.actionTaken,
      needsConfirmation: result.needsConfirmation,
    };
  },
});
```

3. **Router Agent получает результат:**
```typescript
// SDK автоматически:
// 1. Вызывает tool
// 2. Получает результат
// 3. Продолжает разговор с nextResponse
```

### Состояние разговора

**Автоматическое сохранение контекста:**
- SDK сохраняет всю историю разговора
- При handoff специализированный агент получает полный контекст
- При возврате Router Agent помнит всю историю

**Пример потока с контекстом:**

```
User: "Покажи письма от Анны"
Router → Email Agent

Email Agent: "Нашла три письма от Анны"
Email Agent → Router

User: "А что она писала о проекте Восток?"
Router → Knowledge Agent (SDK понимает, что нужен поиск в истории)

Knowledge Agent: "В переписке с Анной о проекте Восток..."
Knowledge Agent → Router

User: "Назначь встречу с ней на следующую неделю"
Router → Planning Agent (tool) (SDK понимает, что нужен анализ + действие)

Planning Agent: "Когда удобно: понедельник, среду или пятницу?"
...
```

---

## Миграционный план

### Этап 1: Подготовка (1-2 дня)

**1.1. Создать структуру файлов:**

```
src/app/agentConfigs/severstalAssistantAgent/
├── index.ts (обновить)
├── improvedPrompt.ts (оставить как legacy)
├── agents/
│   ├── routerAgent.ts (новый Router Agent)
│   ├── emailAgent.ts
│   ├── calendarAgent.ts
│   ├── knowledgeAgent.ts
│   ├── interviewAgent.ts
│   ├── planningAgent.ts (tool)
│   └── complexTaskAgent.ts (tool)
├── prompts/
│   ├── routerPrompt.ts
│   ├── emailPrompt.ts
│   ├── calendarPrompt.ts
│   ├── knowledgePrompt.ts
│   └── interviewPrompt.ts
└── tools/ (существующие)
    ├── userInfoTool.ts
    ├── interviewTools.ts
    ├── ragTools.ts
    ├── supervisorAgent.ts
    └── executeComplexTaskTool.ts
```

**1.2. Извлечь промпты:**
- Разделить `improvedPrompt.ts` на 6 промптов
- Каждый промпт ~100-150 строк
- Сохранить общие секции (Language Control, Pronunciations)

### Этап 2: Реализация специализированных агентов (2-3 дня)

**2.1. Email Agent:**
```typescript
// agents/emailAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { hostedMcpTool } from '@openai/agents';
import { emailAgentPrompt } from '../prompts/emailPrompt';

export const emailAgent = new RealtimeAgent({
  name: 'emailAgent',
  handoffDescription: 'Специалист по работе с email: чтение писем, отправка сообщений',
  instructions: emailAgentPrompt,
  tools: [
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
      // Только email-инструменты
    }),
  ],
});
```

**2.2. Calendar Agent:**
```typescript
// agents/calendarAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { hostedMcpTool } from '@openai/agents';
import { calendarAgentPrompt } from '../prompts/calendarPrompt';

export const calendarAgent = new RealtimeAgent({
  name: 'calendarAgent',
  handoffDescription: 'Специалист по работе с календарём: просмотр расписания, создание событий',
  instructions: calendarAgentPrompt,
  tools: [
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
      // Только calendar-инструменты
    }),
  ],
});
```

**2.3. Knowledge Agent:**
```typescript
// agents/knowledgeAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { knowledgeAgentPrompt } from '../prompts/knowledgePrompt';
import { lightragQuery, lightragQueryData } from '../tools/ragTools';

export const knowledgeAgent = new RealtimeAgent({
  name: 'knowledgeAgent',
  handoffDescription: 'Специалист по поиску информации в базе знаний, документах, истории',
  instructions: knowledgeAgentPrompt,
  tools: [
    lightragQuery,
    lightragQueryData,
    // lightragTrackStatus,
    // lightragGetPipelineStatus,
  ],
});
```

**2.4. Interview Agent:**
```typescript
// agents/interviewAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { interviewAgentPrompt } from '../prompts/interviewPrompt';
import {
  getCurrentUserInfo,
  checkInterviewStatus,
  startInitialInterview,
  conductInitialInterview,
} from '../tools/interviewTools';

export const interviewAgent = new RealtimeAgent({
  name: 'interviewAgent',
  handoffDescription: 'Специалист по персонализации: проведение интервью для новых пользователей',
  instructions: interviewAgentPrompt,
  tools: [
    getCurrentUserInfo,
    checkInterviewStatus,
    startInitialInterview,
    conductInitialInterview,
  ],
});
```

**2.5. Planning Agent (tool):**
```typescript
// agents/planningAgent.ts
import { tool } from '@openai/agents';
import { z } from 'zod';

export const delegateToPlanningAgent = tool({
  name: 'delegateToPlanningAgent',
  description: `
Передать задачу агенту планирования для многошаговых операций (2-7 шагов).

Используйте если:
✅ Множественные зависимые шаги
✅ Условная логика
✅ Анализ, координация
  `,
  parameters: z.object({
    conversationContext: z.string(),
    proposedPlan: z.string(),
    userIntent: z.string(),
    complexity: z.enum(['high', 'medium', 'low']),
  }),
  execute: async (params) => {
    const response = await fetch('/api/supervisor', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const result = await response.json();
    return result.nextResponse;
  },
});
```

**2.6. Complex Task Agent (tool):**
```typescript
// agents/complexTaskAgent.ts
import { tool } from '@openai/agents';
import { z } from 'zod';

export const delegateToComplexTaskAgent = tool({
  name: 'delegateToComplexTaskAgent',
  description: `
Передать ОЧЕНЬ СЛОЖНУЮ задачу (8+ шагов, массовые операции).

⚠️ ВСЕГДА предупреждать пользователя о времени!
  `,
  parameters: z.object({
    taskDescription: z.string().describe('ПОЛНОЕ описание задачи'),
    conversationContext: z.string(),
  }),
  execute: async (params) => {
    const response = await fetch('/api/complex-task', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const result = await response.json();
    return result.report;
  },
});
```

### Этап 3: Реализация Router Agent (1 день)

```typescript
// agents/routerAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { routerAgentPrompt } from '../prompts/routerPrompt';
import { emailAgent } from './emailAgent';
import { calendarAgent } from './calendarAgent';
import { knowledgeAgent } from './knowledgeAgent';
import { interviewAgent } from './interviewAgent';
import { delegateToPlanningAgent } from './planningAgent';
import { delegateToComplexTaskAgent } from './complexTaskAgent';
import { getCurrentUserInfo } from '../tools/userInfoTool';
import { checkInterviewStatus } from '../tools/interviewTools';

export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // Автоматические handoffs
  handoffs: [
    emailAgent,
    calendarAgent,
    knowledgeAgent,
    interviewAgent,
  ],

  // Tools для явного делегирования
  tools: [
    getCurrentUserInfo,
    checkInterviewStatus,
    delegateToPlanningAgent,
    delegateToComplexTaskAgent,
  ],
});

export const routerScenario = [routerAgent];
export default routerScenario;
```

### Этап 4: Обновление index.ts (30 минут)

```typescript
// src/app/agentConfigs/severstalAssistantAgent/index.ts

// Legacy монолитный агент (для rollback)
import { severstalAssistant as severstalAssistantLegacy } from './legacyAgent';

// Новая мультиагентная архитектура
import { routerAgent, routerScenario } from './agents/routerAgent';

// Feature flag для переключения
const USE_MULTI_AGENT = process.env.NEXT_PUBLIC_USE_MULTI_AGENT === 'true';

export const severstalAssistant = USE_MULTI_AGENT
  ? routerAgent
  : severstalAssistantLegacy;

export const chatSeverstalAssistantScenario = USE_MULTI_AGENT
  ? routerScenario
  : [severstalAssistantLegacy];

export default chatSeverstalAssistantScenario;
```

### Этап 5: Тестирование (2-3 дня)

**5.1. Unit тесты для каждого агента:**
```typescript
// __tests__/agents/emailAgent.test.ts
describe('Email Agent', () => {
  it('should handle simple email read', async () => {
    const response = await testAgent(emailAgent, 'Прочитай последнее письмо');
    expect(response).toContain('Открываю почту');
  });

  it('should confirm before sending email', async () => {
    const response = await testAgent(emailAgent, 'Отправь письмо Ивану');
    expect(response).toContain('Отправить?');
  });

  it('should return to router after completion', async () => {
    // Test exit criteria
  });
});
```

**5.2. Интеграционные тесты:**
```typescript
// __tests__/integration/routing.test.ts
describe('Router Agent Delegation', () => {
  it('should delegate email requests to Email Agent', async () => {
    const response = await testRouterAgent('Прочитай письмо');
    expect(response.activeAgent).toBe('emailAgent');
  });

  it('should delegate multi-step tasks to Planning Agent', async () => {
    const response = await testRouterAgent('Прочитай письмо и создай встречу');
    expect(response.toolCalled).toBe('delegateToPlanningAgent');
  });

  it('should return to router after task completion', async () => {
    // Test complete flow
  });
});
```

**5.3. E2E тесты:**
- Полные диалоги пользователя
- Переключение между агентами
- Обработка ошибок
- Edge cases

### Этап 6: Деплой и мониторинг (1 день)

**6.1. Канареечный деплой:**
```typescript
// Feature flag: 10% пользователей
const USE_MULTI_AGENT =
  process.env.NEXT_PUBLIC_USE_MULTI_AGENT === 'true' &&
  Math.random() < 0.1;
```

**6.2. Метрики:**
```typescript
// Логирование переключений агентов
console.log('[Handoff]', {
  from: 'routerAgent',
  to: 'emailAgent',
  reason: 'email read request',
  timestamp: Date.now(),
});
```

**6.3. Мониторинг:**
- Успешность делегирования (% правильных handoffs)
- Время выполнения задач
- Частота возвратов в Router Agent
- Ошибки и эскалации

**6.4. Rollback план:**
```typescript
// Откат на монолитный агент
const USE_MULTI_AGENT = false;
```

### Этап 7: Итерация и оптимизация (ongoing)

**7.1. Анализ логов:**
- Какие агенты используются чаще всего
- Где происходят ошибки
- Какие сценарии не покрыты

**7.2. Оптимизация промптов:**
- Улучшение handoffDescription
- Уточнение exit criteria
- Добавление примеров

**7.3. Добавление новых агентов:**
- При необходимости выделить дополнительные сценарии
- Пример: Reporting Agent, Analytics Agent, etc.

---

## Преимущества новой архитектуры

### 1. Производительность

**Снижение когнитивной нагрузки:**
- Было: 733 строки промпта → модель обрабатывает весь контекст
- Стало: 100-150 строк на агента → фокус на конкретной задаче

**Оптимизация контекста:**
- Модель видит только релевантные инструкции
- Меньше конфликтующих правил
- Быстрее принятие решений

### 2. Поддержка и разработка

**Модульность:**
- Каждый агент независим
- Легко обновлять и тестировать
- Четкие границы ответственности

**Тестируемость:**
- Unit тесты для каждого агента
- Изоляция сценариев
- Простая локализация ошибок

### 3. Масштабируемость

**Добавление новых агентов:**
- Создать новый специализированный агент
- Добавить в handoffs Router Agent
- Обновить routerAgentPrompt

**Расширение функциональности:**
- Новые инструменты добавляются только к нужному агенту
- Не влияют на другие агенты

### 4. Пользовательский опыт

**Естественность:**
- Агенты-специалисты звучат более компетентно
- Фокусированные ответы
- Меньше путаницы

**Скорость:**
- Более быстрые ответы (меньше обработки)
- Четкое переключение между агентами
- Плавные переходы

---

## Рекомендации по реализации

### 1. Начать с 3-4 агентов

**Минимальная конфигурация:**
- Router Agent
- Email Agent
- Calendar Agent
- Planning Agent (tool)

**Затем добавить:**
- Knowledge Agent
- Interview Agent
- Complex Task Agent

### 2. Использовать feature flags

```typescript
const AGENTS_CONFIG = {
  USE_MULTI_AGENT: process.env.NEXT_PUBLIC_USE_MULTI_AGENT === 'true',
  AGENTS_ENABLED: {
    email: true,
    calendar: true,
    knowledge: true,
    interview: false, // Постепенное включение
    complexTask: false,
  },
};
```

### 3. Логировать все handoffs

```typescript
// middleware для логирования
function logHandoff(from: string, to: string, reason: string) {
  console.log('[Handoff]', { from, to, reason, timestamp: Date.now() });

  // Отправка в аналитику
  analytics.track('agent_handoff', { from, to, reason });
}
```

### 4. Создать dashboard мониторинга

**Метрики:**
- Количество handoffs в день
- Средняя продолжительность задачи
- % успешных делегирований
- Частота использования каждого агента
- Ошибки и эскалации

### 5. Документировать каждого агента

Для каждого агента создать документацию:
- Область ответственности
- Доступные инструменты
- Примеры диалогов
- Edge cases
- Exit criteria

---

## Заключение

Декомпозиция монолитного `severstalAssistant` на специализированные агенты:

### Ключевые решения

1. **6 агентов:** Router + 5 специализированных
2. **Handoffs:** Автоматическое переключение через SDK
3. **Tool-based:** Явное делегирование для Planning и Complex Task
4. **Exit criteria:** Четкие правила возврата в Router Agent
5. **Промпты:** 100-150 строк на агента вместо 733 строк

### Результаты

- ✅ Снижение когнитивной нагрузки на модель
- ✅ Улучшение качества ответов
- ✅ Упрощение поддержки и тестирования
- ✅ Масштабируемость и расширяемость
- ✅ Лучший пользовательский опыт

### Следующие шаги

1. Создать структуру файлов
2. Извлечь промпты специализированных агентов
3. Реализовать Router Agent
4. Тестирование
5. Канареечный деплой
6. Мониторинг и оптимизация

Эта архитектура обеспечивает гибкость, производительность и качество для голосового помощника SeverstalAssistant.
