# RAG MCP Server Integration

## Обзор

MCP сервер LightRAG успешно интегрирован с агентом `severstalAssistant` через custom tools.

## Архитектура

### Почему не используется `hostedMcpTool`?

`hostedMcpTool` из `@openai/agents` предназначен для **официальных MCP серверов с поддержкой SSE (Server-Sent Events)** протокола. Ваш LightRAG сервер использует **простой HTTP JSON-RPC** формат, поэтому мы создали custom tools.

### Структура

```
src/app/agentConfigs/severstalAssistantAgent/
├── index.ts           # Основной файл агента с 4 инструментами
├── ragTools.ts        # Custom RAG tools (lightrag_query, lightrag_query_data)
└── supervisorAgent.ts # Supervisor delegation tool
```

## Доступные инструменты

Агент `severstalAssistant` имеет 4 инструмента:

### 1. `hosted_mcp` (Calendar)
- MCP сервер для работы с Google Calendar/Gmail
- URL: `https://rndaibot.app.n8n.cloud/mcp/google_my_account`

### 2. `lightrag_query` (RAG Query)
- **Описание**: Основной RAG запрос с генерацией LLM ответа
- **Режимы**:
  - `mix` (рекомендуется) - интеграция графа и векторов
  - `local` - фокус на конкретных entities
  - `global` - анализ паттернов
  - `hybrid` - комбинированный
  - `naive` - только vector search
  - `bypass` - прямой LLM запрос

**Параметры:**
```typescript
{
  query: string,              // Обязательный
  mode?: string,              // По умолчанию "mix"
  include_references?: boolean, // По умолчанию true
  response_type?: string,     // "Multiple Paragraphs", "Single Paragraph", "Bullet Points"
  top_k?: number,             // Количество top entities
  workspace?: string          // Имя workspace
}
```

**Пример использования в промпте агента:**
```
"Что писали про проект Восток?"
"Напомни задачи прошлого месяца"
```

### 3. `lightrag_query_data` (RAG Data)
- **Описание**: Получение структурированных данных без LLM
- **Возвращает**: entities, relationships, keywords, source chunks

**Параметры:**
```typescript
{
  query: string,          // Обязательный
  mode?: string,          // По умолчанию "mix"
  top_k?: number,         // Количество entities/relationships
  chunk_top_k?: number,   // Количество text chunks
  workspace?: string      // Имя workspace
}
```

### 4. `delegateToSupervisor`
- Делегирование сложных многошаговых задач GPT-4o supervisor

## Конфигурация MCP сервера

### Архитектура подключения

**Важно:** OpenAI Realtime Agents SDK выполняет tool functions **в браузере (client-side)**, поэтому прямое подключение к `http://host.docker.internal:8000` невозможно.

**Решение:** API Proxy endpoint `/api/rag`

```
Браузер → /api/rag → Next.js Server (Docker) → http://host.docker.internal:8000/mcp
```

### Endpoints

**1. API Proxy (для client-side tools):**
- **URL**: `/api/rag`
- **Используется**: RAG tools в браузере
- **Файл**: [src/app/api/rag/route.ts](src/app/api/rag/route.ts)

**2. RAG MCP Server (internal):**
- **URL**: `http://host.docker.internal:8000/mcp`
- **Доступен**: Только из Docker контейнера
- **Протокол**: JSON-RPC 2.0
- **Метод**: `tools/call`

### Формат запроса
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lightrag_query",
    "arguments": {
      "query": "Расскажи о команде",
      "mode": "mix",
      "include_references": true
    }
  }
}
```

### Формат ответа
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"response\": \"...\", \"references\": [...]}"
    }],
    "isError": false
  }
}
```

## Тестирование

### 1. Тест подключения MCP сервера
```bash
curl http://localhost:3000/api/test-mcp
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "status": 200,
  "message": "MCP server is reachable",
  "responsePreview": "{\"message\":\"LightRAG MCP HTTP Wrapper\",\"version\":\"1.0.0\",\"status\":\"running\"}"
}
```

### 2. Полный тест с RAG query
```bash
curl http://localhost:3000/api/test-mcp-tools
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "message": "MCP server is fully operational",
  "server": {
    "status": "running",
    "toolsAvailable": 2
  },
  "tools": [...],
  "testQuery": {
    "jsonrpc": "2.0",
    "result": {
      "content": [{
        "type": "text",
        "text": "{\"response\": \"Команда состоит из...\"}"
      }]
    }
  }
}
```

### 3. Тест через UI
1. Откройте http://localhost:3000
2. Выберите сценарий **"chatSeverstalAssistant"** в dropdown
3. Подключитесь к агенту
4. Задайте вопрос: **"Расскажи о команде и ролях в команде"**

### 4. Тестовая страница RAG
Откройте http://localhost:3000/test-rag для прямого тестирования RAG запросов.

## Логирование

### Build-time логи
При сборке контейнера (`docker compose build`) вы увидите:
```
[severstalAssistant] Agent initialized with tools: {
  toolCount: 4,
  toolNames: [
    'hosted_mcp',
    'lightrag_query',
    'lightrag_query_data',
    'delegateToSupervisor'
  ]
}
[severstalAssistant] Tool 2: {
  name: 'lightrag_query',
  description: 'Выполнить RAG запрос к LightRAG...'
}
```

### Runtime логи
При вызове RAG tools вы увидите:
```
[RAG] Calling lightrag_query with args: { query: '...', mode: 'mix' }
[RAG] lightrag_query completed successfully
```

### Просмотр логов
```bash
# Все логи
docker compose logs realtime-agents -f

# Только RAG логи
docker compose logs realtime-agents -f | grep RAG

# Логи инициализации
docker compose logs realtime-agents | grep severstalAssistant
```

## Troubleshooting

**📚 Полное руководство по решению проблем:** [RAG_TROUBLESHOOTING.md](RAG_TROUBLESHOOTING.md)

### Быстрые решения

**Mixed Content / host.docker.internal ошибки:**
- ✅ Исправлено через API Proxy `/api/rag`
- См. [RAG_TROUBLESHOOTING.md](RAG_TROUBLESHOOTING.md) для деталей

**Ошибка: "Ошибка подключения к базе знаний"**
- Проверьте: `curl http://localhost:3000/api/rag`
- Проверьте логи: `docker compose logs realtime-agents | grep "RAG Proxy"`

**Empty response / "has no output"**
- Проверьте что RAG сервер возвращает валидные данные
- Тест: `curl -X POST http://localhost:3000/api/rag -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lightrag_query","arguments":{"query":"тест","mode":"mix"}}}'`

**Tools не отображаются в агенте**
- Пересоберите: `docker compose build && docker compose up -d`
- Проверьте: `docker compose logs realtime-agents | grep "Agent initialized"`

## Docker Network

Контейнер настроен для доступа к хост-машине через `host.docker.internal`:

```yaml
# docker-compose.yml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Это позволяет контейнеру обращаться к сервисам на хост-машине по адресу `http://host.docker.internal:8000`.

## Файлы конфигурации

### Основные файлы
- **Агент**: [src/app/agentConfigs/severstalAssistantAgent/index.ts](src/app/agentConfigs/severstalAssistantAgent/index.ts)
- **RAG Tools**: [src/app/agentConfigs/severstalAssistantAgent/ragTools.ts](src/app/agentConfigs/severstalAssistantAgent/ragTools.ts)
- **Test API**: [src/app/api/test-mcp-tools/route.ts](src/app/api/test-mcp-tools/route.ts)

### Тестовые файлы
- **Basic test**: [src/app/api/test-mcp/route.ts](src/app/api/test-mcp/route.ts)
- **UI test page**: [src/app/test-rag/page.tsx](src/app/test-rag/page.tsx)

## Промпт агента

Агент настроен на использование RAG инструментов для знаниевых запросов:

```
**LightRAG MCP Tools** - Используется когда пользователь запрашивает информацию
требующую контекст, исторические данные или поиск в базе знаний.

Примеры:
- "Что писали про проект Восток?"
- "Напомни задачи прошлого месяца"
- "Найди информацию о встрече с клиентом"
```

## Статус интеграции

1. ✅ MCP сервер подключен
2. ✅ Custom tools созданы (`lightrag_query`, `lightrag_query_data`)
3. ✅ Агент настроен с 4 инструментами
4. ✅ API Proxy endpoint создан (`/api/rag`)
5. ✅ Решена проблема Mixed Content / host.docker.internal
6. ✅ Тестовые endpoints работают
7. ✅ Работает через UI на https://rndaibot.ru

**Готово к использованию!** 🎉

## Полезные команды

```bash
# Пересборка и запуск
docker compose build && docker compose up -d

# Просмотр логов
docker compose logs -f realtime-agents

# Тест MCP сервера
curl http://localhost:3000/api/test-mcp-tools | jq .

# Остановка
docker compose down

# Полная перезагрузка
docker compose down && docker compose build --no-cache && docker compose up -d
```
