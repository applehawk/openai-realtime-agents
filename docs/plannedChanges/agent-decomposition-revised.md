# Пересмотренная архитектура декомпозиции SeverstalAssistant

## Критический инсайт

**Вопрос:** Почему Email/Calendar выделены в отдельных агентов, если там много своей логики которую нельзя извлечь из MCPServer?

**Ответ:** Вы правы! Email и Calendar - это **MCP Server** (внешний сервис), не логика промпта. Выделять их в отдельные агенты **неправильно**.

---

## Анализ: что в промпте vs что в MCP

### MCP Server (внешний сервис)

```typescript
hostedMcpTool({
  serverLabel: 'calendar',
  serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
  // ↑ Вся логика email/calendar живёт ЗДЕСЬ (на n8n.cloud)
})
```

**MCP Server содержит:**
- ✅ Интеграцию с Google Calendar API
- ✅ Интеграцию с Gmail API
- ✅ Логику чтения/записи email
- ✅ Логику создания/чтения событий
- ✅ Аутентификацию
- ✅ Обработку ошибок

**Промпт агента содержит только:**
- 📝 Правила КОГДА вызывать MCP tools
- 📝 Правила подтверждения перед отправкой
- 📝 Сбор параметров от пользователя
- 📝 Форматирование ответов

### Что действительно можно декомпозировать

**1. Логика маршрутизации** (Router Agent)
- Определение намерения пользователя
- Выбор пути выполнения (Direct, Supervisor, RAG, etc.)

**2. Логика RAG поиска** (Knowledge Agent)
- Семантический поиск в базе знаний
- Выбор режима поиска (mix, local, global)
- Форматирование результатов

**3. Логика планирования** (Planning Agent - tool)
- Многошаговые задачи
- Условная логика
- Координация между источниками

**4. Логика персонализации** (Interview Agent)
- Сбор предпочтений пользователя
- Проведение интервью
- Сохранение в профиль

**5. Логика комплексных задач** (Complex Task Agent - tool)
- Декомпозиция на подзадачи
- Массовые операции
- Долгое выполнение

---

## Пересмотренная архитектура

### Вариант 1: Минималистичный (РЕКОМЕНДУЕМЫЙ)

```
┌─────────────────────────────────────────────────────────┐
│              Router Agent (Главный)                      │
│                                                          │
│  • Определяет намерение                                  │
│  • Маршрутизирует запросы                                │
│  • Вызывает MCP tools напрямую (email/calendar)          │
│  • Делегирует сложные задачи                             │
│                                                          │
│  Tools:                                                  │
│  ├─ hostedMcpTool (email/calendar) ← MCP Server         │
│  ├─ delegateToPlanning (tool)                           │
│  ├─ delegateToComplexTask (tool)                        │
│  └─ interview tools                                      │
│                                                          │
│  Handoffs:                                               │
│  └─ Knowledge Agent                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌──────────────────┐           ┌──────────────────┐
    │ Knowledge Agent  │           │  Interview Agent │
    │                  │           │                  │
    │ • RAG поиск      │           │ • Персонализация │
    │ • История        │           │ • Опрос          │
    │ • Документы      │           │ • Профиль        │
    │                  │           │                  │
    │ Tools:           │           │ Tools:           │
    │ • lightrag_query │           │ • interview tools│
    └──────────────────┘           └──────────────────┘
```

**Итого: 3 агента**
1. **Router Agent** - главный (email/calendar MCP + planning + complex task tools)
2. **Knowledge Agent** - RAG поиск (handoff)
3. **Interview Agent** - персонализация (handoff)

---

### Вариант 2: С выделением операций (АЛЬТЕРНАТИВНЫЙ)

Если хотите разделить по **типу операций** (read vs write):

```
┌─────────────────────────────────────────────────────────┐
│              Router Agent (Главный)                      │
│                                                          │
│  • Определяет намерение                                  │
│  • Маршрутизирует запросы                                │
│                                                          │
│  Handoffs:                                               │
│  ├─ Read Operations Agent                                │
│  ├─ Write Operations Agent                               │
│  ├─ Knowledge Agent                                      │
│  └─ Interview Agent                                      │
│                                                          │
│  Tools:                                                  │
│  ├─ delegateToPlanning                                   │
│  └─ delegateToComplexTask                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│Read Ops Agent│      │Write Ops Agent│    │Knowledge Agent│
│              │      │              │     │              │
│• Чтение email│      │• Отправка    │     │• RAG поиск   │
│• Чтение cal  │      │• Создание    │     │• История     │
│              │      │• Подтверждения│    │              │
│              │      │              │     │              │
│Tools:        │      │Tools:        │     │Tools:        │
│• MCP (read)  │      │• MCP (write) │     │• lightrag    │
└──────────────┘      └──────────────┘     └──────────────┘
        │                     │
        └─────────────────────┘
                  │
                  ▼
          ┌──────────────┐
          │Interview Agent│
          │              │
          │• Персонализ. │
          │• Опрос       │
          │              │
          │Tools:        │
          │• interview   │
          └──────────────┘
```

**Итого: 5 агентов**
1. **Router Agent** - маршрутизатор
2. **Read Operations Agent** - чтение (email, calendar)
3. **Write Operations Agent** - запись (отправка, создание)
4. **Knowledge Agent** - RAG поиск
5. **Interview Agent** - персонализация

**Проблема этого подхода:**
- ❌ Read и Write всё равно используют один и тот же MCP Server
- ❌ Дублирование правил работы с MCP
- ❌ Усложнение без реальной пользы

---

## РЕКОМЕНДАЦИЯ: Вариант 1 (Минималистичный)

### Почему это лучший подход?

**1. MCP - это внешний сервис**
- Email/Calendar логика живёт на `rndaibot.app.n8n.cloud`
- Промпт агента только управляет ВЫЗОВАМИ этого сервиса
- Нет смысла выделять отдельные агенты для обёрток вокруг MCP

**2. Реальная декомпозиция логики**
- ✅ **Router Agent** - управляет всеми MCP tools + маршрутизация
- ✅ **Knowledge Agent** - отдельная логика RAG (сложный поиск)
- ✅ **Interview Agent** - отдельный флоу персонализации
- ✅ **Planning/Complex Task** - backend tools (не RealtimeAgents)

**3. Простота поддержки**
- Меньше агентов = меньше handoffs
- Меньше переключений контекста
- Легче отлаживать

**4. Производительность**
- Меньше overhead на handoffs
- Более быстрые ответы
- Меньше latency

---

## Детальная спецификация: Вариант 1

### 1. Router Agent (Главный агент)

**Роль:** Главный голосовой помощник

**Ответственность:**
- ✅ Определение намерения пользователя
- ✅ Прямые вызовы MCP tools (email/calendar)
- ✅ Делегация в Knowledge Agent для RAG
- ✅ Делегация в Interview Agent для персонализации
- ✅ Делегация в Planning Agent (tool) для многошаговых задач
- ✅ Делегация в Complex Task Agent (tool) для массовых операций

**Промпт:** ~250-300 строк

**Структура промпта:**

```typescript
export const routerAgentPrompt = `
## Role & Objective

Вы главный голосовой помощник (Router Agent). Ваша задача:
- Понять намерение пользователя
- Выполнить простые задачи напрямую через MCP tools
- Делегировать сложные задачи специализированным агентам
- Отвечать на русском языке

---

## Language Control

СТРОГОЕ ПРАВИЛО: только русский язык
[... секция из оригинального промпта ...]

---

## Opening Behavior

При начале КАЖДОГО разговора:
1. Вызвать getCurrentUserInfo (получить userId)
2. Вызвать checkInterviewStatus(userId)
3. Если интервью НЕ пройдено → Делегировать Interview Agent
4. Если пройдено → Краткое приветствие

---

## Execution Paths

### Path 1: Direct MCP Tools (email/calendar)

**Когда использовать:**
✅ Одношаговые операции
✅ Чтение email/календаря
✅ Отправка email (с подтверждением)
✅ Создание события (с подтверждением)

**Примеры:**
- «Прочитай последнее письмо» → read_latest_email (MCP)
- «Покажи встречи на завтра» → get_calendar_events (MCP)
- «Отправь письмо Ивану» → send_email (MCP) [с подтверждением]
- «Создай встречу» → create_calendar_event (MCP) [с подтверждением]

**Confirmation Rules:**
- Чтение: НЕТ подтверждения
- Отправка email: ВСЕГДА подтверждать
- Создание события: ВСЕГДА подтверждать

**Preambles:**
- Перед чтением: «Открываю почту», «Смотрю календарь»
- Перед отправкой: «Готовлю письмо», «Создаю событие»

---

### Path 2: Knowledge Agent (RAG поиск)

**Когда делегировать:**
✅ Вопросы о прошлом, истории
✅ Поиск в документах, заметках
✅ «Что писали о...», «Когда обсуждали...»

**Handoff:** Автоматическое переключение через SDK

**Примеры:**
- «Что писали о проекте Восток?» → Knowledge Agent
- «Напомни задачи по проекту» → Knowledge Agent
- «Когда в последний раз говорили о бюджете?» → Knowledge Agent

---

### Path 3: Planning Agent (tool) - многошаговые задачи

**Когда использовать:**
✅ 2-7 зависимых шагов
✅ Условная логика
✅ Анализ, координация

**Преамбула:** «Секундочку, уточню детали»

**Примеры:**
- «Прочитай письмо от Анны и назначь встречу» → delegateToPlanning
- «Найди свободное время и создай встречу с Петром» → delegateToPlanning

**После делегации:**
- Использовать nextResponse ДОСЛОВНО

---

### Path 4: Complex Task Agent (tool) - массовые операции

**Когда использовать:**
✅ 8+ шагов
✅ Массовые операции (множество людей)
✅ Долгое выполнение

**ВАЖНО:** Предупредить + получить подтверждение!

**Преамбула:** «Это очень сложная задача, может занять несколько минут. Продолжить?»

**Примеры:**
- «Найди всех участников проекта, проверь календари, отправь приглашения»
  → delegateToComplexTask (после подтверждения)

---

### Path 5: Interview Agent - персонализация

**Когда делегировать:**
✅ Новый пользователь (checkInterviewStatus = false)
✅ Пользователь просит персонализацию

**Handoff:** Автоматическое переключение

---

## Response Style

- 3-5 слов для подтверждений: «Готово!», «Письмо отправлено»
- 10-20 слов для прямых ответов
- Только русский язык
- Варьировать фразы

---

## Information Gathering

Если параметры отсутствуют:
- Спросить ОДИН параметр за раз
- Примеры: «Кому отправить?», «Какая тема?», «Текст письма?»

---

## Error Handling

После 1-го сбоя:
- Повторить с другими параметрами

После 2-го сбоя:
- Если сложная задача → delegateToPlanning
- Если простая → сообщить пользователю

После 3-го сбоя:
- «К сожалению, не могу выполнить. Попробуем по-другому?»

---

## Example Flows

[Примеры диалогов...]
`;
```

**Инструменты:**

```typescript
export const routerAgent = new RealtimeAgent({
  name: 'routerAgent',
  voice: 'sage',
  instructions: routerAgentPrompt,

  // MCP tools для прямого выполнения
  tools: [
    // Email/Calendar MCP Server
    hostedMcpTool({
      serverLabel: 'calendar',
      serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),

    // User info и interview
    getCurrentUserInfo,
    checkInterviewStatus,

    // Backend tools для сложных задач
    delegateToPlanningAgent,      // tool (gpt-4 supervisor)
    delegateToComplexTaskAgent,   // tool (hierarchical executor)
  ],

  // Специализированные агенты для handoff
  handoffs: [
    knowledgeAgent,    // RAG поиск
    interviewAgent,    // Персонализация
  ],
});
```

---

### 2. Knowledge Agent (RAG поиск)

**Роль:** Специалист по поиску знаний

**Ответственность:**
- ✅ Семантический поиск в базе знаний
- ✅ Исторический контекст
- ✅ Поиск в документах, заметках, старых письмах

**Промпт:** ~130 строк

**Структура промпта:**

```typescript
export const knowledgeAgentPrompt = `
## Role & Objective

Вы специалист по поиску информации в базе знаний. Ваша задача:
- Искать информацию в документах, заметках, истории переписки
- Предоставлять резюме найденной информации
- Ссылаться на источники
- Отвечать на русском языке

---

## Core Capabilities

✅ Поиск по ключевым словам
✅ Исторический контекст
✅ Семантический поиск в графе знаний
✅ Предоставление ссылок на источники

❌ НЕ выполнять: чтение конкретных недавних писем (это Router Agent)
❌ НЕ выполнять: создание данных (только поиск)

---

## Tools

- lightrag_query (основной поиск)
- lightrag_query_data (структурированные данные)
- lightrag_track_status (статус обработки)
- lightrag_get_pipeline_status (статус системы)

---

## Search Modes

- **mix** (по умолчанию): лучший общий результат
- **local**: фокусированный поиск по сущностям
- **global**: тренды и паттерны
- **hybrid**: local + global

Default: { mode: 'mix', include_references: true, top_k: 10 }

---

## Preambles

«Ищу в документах», «Проверяю заметки», «Смотрю историю»

---

## Response Style

- 20-40 слов для резюме
- Упомянуть количество результатов
- Предложить детали

Пример: «Нашла три обсуждения проекта Восток: первое о бюджете, второе о сроках, третье о команде. Подробности?»

---

## Exit Criteria

После предоставления результатов:
- Спросить, нужны ли детали
- Если пользователь хочет действие (отправить письмо, создать встречу) → вернуться к Router Agent

---

## Edge Cases

**Нет результатов:**
«Ничего не нашла по этому запросу. Попробовать другие ключевые слова?»

**Слишком много результатов (50+):**
«Нашла много результатов. Уточните период или тему?»

**Система занята:**
«Система занята. Попробовать попроще запрос?»

---

## Example Flows

[Примеры...]
`;
```

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

### 3. Interview Agent (Персонализация)

**Роль:** Специалист по персонализации

**Ответственность:**
- ✅ Проверка статуса интервью
- ✅ Проведение опроса (4 + 3 вопроса)
- ✅ Сохранение в профиль

**Промпт:** ~110 строк

**Структура промпта:**

```typescript
export const interviewAgentPrompt = `
## Role & Objective

Вы специалист по персонализации опыта. Ваша задача:
- Провести краткое интервью (3-5 минут)
- Собрать предпочтения пользователя
- Сохранить данные в профиль
- Создать дружелюбную атмосферу

---

## Interview Flow

1. Получить userId через getCurrentUserInfo (уже вызван Router Agent)
2. Запустить через startInitialInterview(userId, position)
3. Задать 4 обязательных вопроса через conductInitialInterview
4. Предложить 3 опциональных вопроса
5. Сохранить автоматически
6. Подтвердить: «Спасибо! Предпочтения сохранены»
7. Вернуться к Router Agent

---

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

---

## Response Style

- Естественный, не формальный
- Персонализировать вопросы (использовать имя, должность)
- НЕ звучать как опросник
- По одному вопросу за раз

---

## Exit Criteria

После завершения интервью:
- «Спасибо! Я сохранил ваши предпочтения»
- «Теперь буду учитывать их в работе»
- Автоматически вернуться к Router Agent

---

## Example Flow

[Пример диалога...]
`;
```

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
  // Примечание: checkInterviewStatus уже вызван Router Agent
});
```

---

### 4. Planning Agent (tool) - Backend Supervisor

**Не RealtimeAgent, а tool для делегации backend supervisor (gpt-4)**

```typescript
export const delegateToPlanningAgent = tool({
  name: 'delegateToPlanningAgent',
  description: `
Передать задачу агенту планирования для многошаговых операций (2-7 шагов).

Используйте если:
✅ Множественные зависимые шаги
✅ Условная логика: "если X, то Y, иначе Z"
✅ Неоднозначные параметры требуют интерпретации
✅ Кросс-референсинг множественных источников
✅ Анализ, резюмирование, сравнение

Примеры:
- "Прочитай письмо от Анны и назначь встречу на предложенное время"
- "Найди свободное время завтра и создай встречу с Петром"

НЕ использовать для:
❌ Простых одношаговых задач
❌ Чистого поиска (используйте Knowledge Agent)
❌ Очень сложных задач 8+ шагов (используйте Complex Task Agent)
  `,
  parameters: z.object({
    conversationContext: z.string().describe('Контекст разговора (2-3 предложения)'),
    proposedPlan: z.string().describe('Предполагаемый план (1-2 предложения)'),
    userIntent: z.string().describe('Конечная цель пользователя (1 предложение)'),
    complexity: z.enum(['high', 'medium', 'low']),
  }),
  execute: async (params) => {
    // Backend API call to gpt-4 supervisor
    const response = await fetch('/api/supervisor', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const result = await response.json();
    return result.nextResponse; // Supervisor's formatted response
  },
});
```

---

### 5. Complex Task Agent (tool) - Backend Hierarchical Executor

**Не RealtimeAgent, а tool для делегации backend hierarchical executor**

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
    taskDescription: z.string().describe('ПОЛНОЕ описание задачи (3-5 предложений)'),
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

---

## Сравнение: Старая vs Новая архитектура

### ❌ Старая (неправильная) - 6 агентов

```
Router Agent
├─ Email Agent           ← Ненужный! Просто обёртка вокруг MCP
├─ Calendar Agent        ← Ненужный! Просто обёртка вокруг MCP
├─ Knowledge Agent       ← Нужен (RAG логика)
├─ Interview Agent       ← Нужен (персонализация)
├─ Planning Agent (tool)
└─ Complex Task (tool)
```

**Проблемы:**
- ❌ Email/Calendar агенты - просто обёртки вокруг MCP
- ❌ Дублирование правил работы с MCP
- ❌ Лишние handoffs
- ❌ Усложнение без пользы

---

### ✅ Новая (правильная) - 3 агента

```
Router Agent (с MCP tools внутри)
├─ Knowledge Agent       ← Нужен (RAG логика)
├─ Interview Agent       ← Нужен (персонализация)
├─ Planning Agent (tool)
└─ Complex Task (tool)
```

**Преимущества:**
- ✅ Router Agent напрямую работает с MCP
- ✅ Меньше агентов = проще
- ✅ Меньше handoffs = быстрее
- ✅ Реальная декомпозиция логики (RAG, Interview)

---

## Структура файлов

```
src/app/agentConfigs/severstalAssistantAgent/
├── index.ts (точка входа)
├── agents/
│   ├── routerAgent.ts (главный, с MCP tools)
│   ├── knowledgeAgent.ts (RAG)
│   └── interviewAgent.ts (персонализация)
├── prompts/
│   ├── routerPrompt.ts (~300 строк)
│   ├── knowledgePrompt.ts (~130 строк)
│   └── interviewPrompt.ts (~110 строк)
├── tools/
│   ├── planningAgent.ts (tool для backend supervisor)
│   ├── complexTaskAgent.ts (tool для backend executor)
│   ├── userInfoTool.ts
│   ├── interviewTools.ts
│   └── ragTools.ts
└── legacy/
    └── improvedPrompt.ts (старый монолитный, для rollback)
```

---

## План миграции (пересмотренный)

### Этап 1: Подготовка (1 день)
- Создать структуру файлов
- Извлечь промпты из монолитного агента

### Этап 2: Реализация (2 дня)
- Router Agent (~300 строк промпта + MCP tools)
- Knowledge Agent (~130 строк)
- Interview Agent (~110 строк)
- Planning Agent (tool)
- Complex Task Agent (tool)

### Этап 3: Тестирование (2 дня)
- Unit тесты для каждого агента
- Интеграционные тесты
- E2E тесты

### Этап 4: Деплой (1 день)
- Feature flag
- Канареечный деплой
- Мониторинг

**Общее время:** 6 дней (вместо 7-10)

---

## Метрики успеха

### До (монолитный)
- Промпт: 733 строки
- Агентов: 1
- Сложность: Высокая

### После (декомпозированный)
- Промпты: 300 + 130 + 110 = 540 строк (↓ 26%)
- Агентов: 3
- Сложность: Средняя

### Выгоды
- ✅ ↓ 26% общий размер промптов
- ✅ ↑ Фокусированность каждого агента
- ✅ ↑ Тестируемость
- ✅ ↑ Поддерживаемость
- ✅ Простая архитектура (3 агента вместо 6)

---

## Заключение

### Ключевое решение

**НЕ выделять Email/Calendar в отдельные агенты**, потому что:
1. MCP Server - это внешний сервис (n8n.cloud)
2. Вся логика email/calendar живёт в MCP, не в промпте
3. Агент только управляет ВЫЗОВАМИ MCP tools
4. Выделение в отдельные агенты = ненужные обёртки

### Финальная архитектура

**3 RealtimeAgents:**
1. **Router Agent** - главный (с MCP tools внутри)
2. **Knowledge Agent** - RAG поиск (handoff)
3. **Interview Agent** - персонализация (handoff)

**2 Backend Tools:**
4. **Planning Agent** - многошаговые задачи (tool)
5. **Complex Task Agent** - массовые операции (tool)

### Следующие шаги

1. Создать структуру файлов
2. Извлечь 3 промпта из монолитного
3. Реализовать Router Agent с MCP tools
4. Реализовать Knowledge и Interview Agents
5. Тестирование
6. Деплой
