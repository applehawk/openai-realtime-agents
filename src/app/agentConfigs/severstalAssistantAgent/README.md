# SeverstalAssistant Multi-Agent Architecture (v3.0)

## Overview

SeverstalAssistant использует **многоагентную архитектуру** с центральным Router Agent, который координирует работу специализированных агентов для различных сценариев использования.

**Основная идея**: Вместо одного монолитного промпта (733 строки) система разбита на **3 фронтенд RealtimeAgents** + **2 бэкенд агента** + **1 внешний сервис**.

---

## Архитектура

```
Router Agent (центральное управление)
├─ handoff → Knowledge Agent → [exit criteria] → return to Router
├─ handoff → Interview Agent → [exit criteria] → return to Router
├─ tool call → Planning Agent (backend) → [response] → return to Router
├─ tool call → Complex Task Agent (backend) → [response] → return to Router
└─ direct call → MCP Server (n8n.cloud) → [response] → return to Router
```

### Frontend RealtimeAgents (gpt-4o-realtime-mini)

1. **Router Agent** (`agents/routerAgent.ts`)
   - Главный оркестратор
   - Роутинг запросов к специализированным агентам
   - Прямое выполнение простых операций через MCP tools
   - Промпт: `prompts/routerPrompt.ts` (296 строк)

2. **Knowledge Agent** (`agents/knowledgeAgent.ts`)
   - Специалист по RAG поиску
   - LightRAG (knowledge graph + vector search)
   - Исторический контекст и поиск информации
   - Промпт: `prompts/knowledgePrompt.ts` (131 строка)

3. **Interview Agent** (`agents/interviewAgent.ts`)
   - Специалист по персонализации
   - Проведение интервью (4 обязательных + 3 опциональных вопроса)
   - Сохранение предпочтений пользователя
   - Промпт: `prompts/interviewPrompt.ts` (116 строк)

### Backend Agents (gpt-4o)

4. **Planning Agent** (`supervisorAgent.ts` → `/api/supervisor/agent.ts`)
   - Многошаговые задачи (2-7 шагов)
   - Условная логика и анализ
   - Координация между tools
   - Вызов: `delegateToSupervisor` tool

5. **Complex Task Agent** (`executeComplexTaskTool.ts` → `/api/tasks/execute`)
   - Очень сложные задачи (8+ шагов)
   - Иерархическая декомпозиция задач
   - Массовые операции
   - Вызов: `executeComplexTask` tool

### External Service

6. **MCP Server** (n8n.cloud)
   - Email операции (read, send, search)
   - Calendar операции (events, create, update)
   - Вся логика на стороне n8n.cloud
   - Вызов: `hostedMcpTool` в Router Agent

---

## Структура файлов

```
severstalAssistantAgent/
├── README.md                           # Этот файл
├── index.ts                            # Главный экспорт (routerAgent)
│
├── agents/                             # RealtimeAgent реализации
│   ├── routerAgent.ts                  # Router Agent (главный)
│   ├── knowledgeAgent.ts               # Knowledge Agent (RAG)
│   └── interviewAgent.ts               # Interview Agent (персонализация)
│
├── prompts/                            # Промпты для агентов
│   ├── routerPrompt.ts                 # Router Agent prompt (296 строк)
│   ├── knowledgePrompt.ts              # Knowledge Agent prompt (131 строка)
│   └── interviewPrompt.ts              # Interview Agent prompt (116 строк)
│
├── legacy/                             # Резервные копии для rollback
│   └── improvedPrompt.ts               # v2.0 монолитный промпт
│
├── supervisorAgent.ts                  # Planning Agent (delegateToSupervisor tool)
├── executeComplexTaskTool.ts           # Complex Task Agent (executeComplexTask tool)
├── ragTools.ts                         # LightRAG tools для Knowledge Agent
└── interviewTools.ts                   # Interview tools для Interview Agent
```

---

## Паттерны коммуникации

### 1. Handoff (Автоматический возврат)

**Используется для**: Knowledge Agent, Interview Agent

```typescript
// Router Agent делегирует через handoff
handoffs: [knowledgeAgent, interviewAgent]

// Flow:
User → Router Agent
       ↓ [handoff]
       Knowledge Agent (RAG поиск)
       ↓ [exit criteria]
       Router Agent (автоматический возврат)
```

**Механизм возврата**: SDK автоматически возвращает управление Router Agent при достижении exit criteria.

### 2. Tool Call (Явный возврат через response)

**Используется для**: Planning Agent, Complex Task Agent, MCP Server

```typescript
// Router Agent вызывает tool
tools: [delegateToSupervisor, executeComplexTask, hostedMcpTool(...)]

// Flow:
User → Router Agent
       ↓ [tool call via fetch]
       Backend Agent (выполнение)
       ↓ [response.nextResponse]
       Router Agent (использует ответ дословно)
```

**Механизм возврата**: Backend agent возвращает `response.nextResponse`, который Router Agent использует БЕЗ изменений.

---

## Примеры сценариев

### Сценарий 1: Простое чтение email (MCP)

```
User: «Прочитай последнее письмо»

Router Agent:
  - Понимает намерение (чтение email)
  - Path: Direct MCP Tools
  - Вызывает: hostedMcpTool → read_latest_email
  - Получает ответ
  - Озвучивает: «Последнее письмо от Ивана...»
```

### Сценарий 2: RAG поиск (Knowledge Agent handoff)

```
User: «Что писали о проекте Восток?»

Router Agent:
  - Понимает намерение (вопрос о прошлом)
  - Path: Knowledge Agent (handoff)
  - SDK переключает на Knowledge Agent

Knowledge Agent:
  - Вызывает lightragQuery("проект Восток")
  - Получает контекст из knowledge graph
  - Формулирует ответ
  - Exit criteria: результат озвучен
  - SDK возвращает в Router Agent

Router Agent:
  - Готов к следующему запросу
```

### Сценарий 3: Многошаговая задача (Planning Agent tool)

```
User: «Прочитай письмо от Анны и назначь встречу»

Router Agent:
  - Понимает намерение (2+ зависимых шага)
  - Path: Planning Agent (tool call)
  - Вызывает: delegateToSupervisor({
      conversationContext: "...",
      proposedPlan: "Прочитать письмо, извлечь дату, создать встречу",
      userIntent: "Назначить встречу на основе письма",
      complexity: 'medium'
    })

Planning Agent (backend):
  - Выполняет шаги (read email → parse date → create event)
  - Возвращает: { nextResponse: "Анна предлагает встречу завтра в 15:00..." }

Router Agent:
  - Получает response.nextResponse
  - Использует ДОСЛОВНО: «Анна предлагает встречу завтра в 15:00...»
  - Готов к следующему запросу
```

### Сценарий 4: Интервью нового пользователя (Interview Agent handoff)

```
[Начало разговора]

Router Agent:
  - Вызывает getCurrentUserInfo
  - Вызывает checkInterviewStatus(userId) → false
  - Path: Interview Agent (handoff)
  - SDK переключает на Interview Agent

Interview Agent:
  - «Могу провести краткий опрос на 3-5 минут?»
  - User: «Да»
  - Вызывает startInitialInterview
  - Проводит 4 обязательных вопроса
  - Сохраняет предпочтения в RAG
  - Exit criteria: интервью завершено
  - SDK возвращает в Router Agent

Router Agent:
  - «Чем могу помочь?»
```

---

## Routing Logic (Decision Matrix)

Router Agent принимает решение по следующему алгоритму:

```
ПОЛУЧЕН ЗАПРОС ПОЛЬЗОВАТЕЛЯ
    ↓
Это новый пользователь? → ДА → Interview Agent (handoff)
    ↓ НЕТ
Это вопрос о прошлом/истории? → ДА → Knowledge Agent (handoff)
    ↓ НЕТ
Это одно простое действие? → ДА → Direct MCP Tools
    ↓ НЕТ
Задача имеет 8+ шагов? → ДА → Complex Task Agent (tool + подтверждение)
    ↓ НЕТ
Множественные шаги (2-7)? → ДА → Planning Agent (tool)
    ↓ НЕТ
Неуверен? → Planning Agent (tool) [безопасный выбор]
```

**Принцип безопасности**: При сомнении между Direct и Planning → ВСЕГДА выбирать Planning.

---

## Exit Criteria (Правила возврата)

### Knowledge Agent → Router Agent

Возврат при:
- ✅ Результат RAG поиска озвучен
- ✅ Пользователь хочет ДЕЙСТВИЕ (отправить письмо, создать встречу)
- ✅ Запрос выходит за рамки RAG
- ✅ Пользователь явно переключает тему

### Interview Agent → Router Agent

Возврат при:
- ✅ Интервью завершено (все вопросы заданы)
- ✅ Пользователь отказался от интервью
- ✅ Пользователь прервал интервью

---

## Модификация архитектуры

### Добавление нового агента

1. Создайте промпт в `prompts/`:
```typescript
// prompts/newAgentPrompt.ts
export const newAgentPrompt = `
## Role & Objective
...
## Exit Criteria
...
`;
```

2. Создайте агента в `agents/`:
```typescript
// agents/newAgent.ts
import { RealtimeAgent } from '@openai/agents/realtime';
import { newAgentPrompt } from '../prompts/newAgentPrompt';

export const newAgent = new RealtimeAgent({
  name: 'newAgent',
  handoffDescription: 'Описание для контекста передачи',
  instructions: newAgentPrompt,
  tools: [/* ваши tools */],
});
```

3. Добавьте handoff в Router Agent:
```typescript
// agents/routerAgent.ts
import { newAgent } from './newAgent';

export const routerAgent = new RealtimeAgent({
  // ...
  handoffs: [knowledgeAgent, interviewAgent, newAgent],
});
```

4. Обновите routerPrompt.ts:
```typescript
// prompts/routerPrompt.ts
// Добавьте новый Path в Routing Logic
### Path N: New Agent (handoff)
**Когда делегировать:**
✅ Условие 1
✅ Условие 2
```

### Модификация существующего промпта

Все промпты находятся в `prompts/`. Редактируйте нужный файл:

```typescript
// prompts/routerPrompt.ts
export const routerAgentPrompt = `
## Role & Objective
[Измените роль или objectives]

## Routing Logic
[Добавьте/измените пути]
`;
```

**Best Practice**: Используйте комментарии `// v3.1: Added XYZ` для отслеживания изменений.

---

## Rollback к v2.0 (монолитный агент)

Если новая архитектура вызывает проблемы, можно откатиться к v2.0:

### Шаг 1: Восстановите index.ts

```typescript
// index.ts
import { chatSeverstalAssistantScenario as legacyScenario } from './legacy/improvedPrompt';

export const severstalAssistant = legacyScenario[0];
export const chatSeverstalAssistantScenario = legacyScenario;
export default chatSeverstalAssistantScenario;
```

### Шаг 2: Убедитесь, что legacy код работает

Файл `legacy/improvedPrompt.ts` содержит полную рабочую версию v2.0.

### Шаг 3: Перезапустите сервер

```bash
npm run dev
```

---

## Тестирование

### Проверка Router Agent

```bash
# Запустите dev сервер
npm run dev

# Откройте http://localhost:3000
# Выберите "Severstal Assistant" в Scenario dropdown
```

**Тестовые сценарии**:

1. **MCP Tools**: "Прочитай последнее письмо"
   - Ожидается: Router Agent вызовет read_latest_email

2. **Knowledge Agent**: "Что писали о проекте Восток?"
   - Ожидается: Handoff к Knowledge Agent → RAG поиск → возврат

3. **Interview Agent**: Новый пользователь (checkInterviewStatus = false)
   - Ожидается: Handoff к Interview Agent → опрос → возврат

4. **Planning Agent**: "Прочитай письмо от Анны и назначь встречу"
   - Ожидается: Tool call delegateToSupervisor → многошаговое выполнение

### Проверка логов

Router Agent выводит информацию при инициализации:

```javascript
console.log('[severstalAssistant] Multi-agent architecture initialized');
console.log('[severstalAssistant] Router Agent:', {
  name: 'routerAgent',
  handoffCount: 2, // knowledgeAgent, interviewAgent
  handoffNames: ['knowledgeAgent', 'interviewAgent'],
  toolCount: 5, // MCP + user tools + backend tools
});
```

---

## Troubleshooting

### Проблема: Agent не возвращается в Router Agent

**Причина**: Exit criteria не определены или не достигнуты

**Решение**:
1. Проверьте промпт агента на наличие раздела `## Exit Criteria`
2. Убедитесь, что агент озвучивает результат перед завершением
3. Проверьте логи SDK на наличие ошибок handoff

### Проблема: Planning Agent не вызывается

**Причина**: Router Agent выбирает Direct MCP вместо Planning

**Решение**:
1. Проверьте Decision Matrix в routerPrompt.ts
2. Убедитесь, что задача имеет 2+ зависимых шага
3. При сомнении явно укажите: "это сложная задача, делегируй Planning Agent"

### Проблема: MCP Server не отвечает

**Причина**: n8n.cloud недоступен или неправильный serverUrl

**Решение**:
1. Проверьте доступность: `https://rndaibot.app.n8n.cloud/mcp/google_my_account`
2. Убедитесь, что serverLabel совпадает с конфигурацией n8n
3. Проверьте сетевые запросы в DevTools

---

## Версионирование

- **v1.0**: Базовый агент (устарел)
- **v2.0**: Монолитный промпт (733 строки) → `legacy/improvedPrompt.ts`
- **v3.0**: Multi-agent architecture (текущая версия)

---

## Дополнительная документация

- **[ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)**: Детальная архитектура с диаграммами
- **[agent-decomposition-final.md](../../../docs/agent-decomposition-final.md)**: Спецификация декомпозиции
- **[severstal-assistant-agent-prompt-documentation.md](../../../docs/severstal-assistant-agent-prompt-documentation.md)**: Документация v2.0 промпта

---

## Contributing

При внесении изменений:

1. **Обновляйте промпты** в `prompts/` (не в агентах напрямую)
2. **Используйте семантическое версионирование** для breaking changes
3. **Сохраняйте резервные копии** в `legacy/` перед крупными изменениями
4. **Документируйте Exit Criteria** для новых агентов
5. **Тестируйте все пути** (MCP, handoffs, tool calls) перед коммитом

---

**End of README**
