# RAG MCP Server - Решение проблем

## Проблема: Mixed Content & host.docker.internal

### Симптомы

**Консоль браузера:**
```
Mixed Content: The page at 'https://rndaibot.ru/' was loaded over HTTPS,
but requested an insecure resource 'http://host.docker.internal:8000/mcp'.
This request has been blocked; the content must be served over HTTPS.
```

**Лог в консоли:**
```
[MCP] Function call lightrag_query completed but has no output
```

### Причина

OpenAI Realtime Agents SDK выполняет **tool functions в браузере (client-side)**, а не на сервере. Это создаёт две проблемы:

1. **Mixed Content** - HTTPS страница не может делать HTTP запросы
2. **host.docker.internal недоступен** - этот hostname работает только внутри Docker контейнера, но не в браузере

### Решение ✅

Создан **API Proxy endpoint** `/api/rag`, который:
- Работает на сервере (имеет доступ к `host.docker.internal`)
- Принимает запросы от браузера через HTTPS
- Пересылает их на RAG MCP сервер

## Архитектура

### До исправления ❌
```
Браузер → http://host.docker.internal:8000/mcp
         ⚠️ Блокировка: Mixed Content
         ⚠️ DNS ошибка: host.docker.internal не резолвится
```

### После исправления ✅
```
Браузер → /api/rag (HTTPS) → Next.js Server (внутри Docker) → http://host.docker.internal:8000/mcp
         ✅ HTTPS              ✅ Proxy в контейнере           ✅ Работает
```

## Конфигурация

### 1. API Proxy Endpoint

**Файл:** [src/app/api/rag/route.ts](src/app/api/rag/route.ts)

```typescript
const RAG_SERVER_URL = 'http://host.docker.internal:8000/mcp';

export async function POST(request: NextRequest) {
  // Принимаем JSON-RPC запрос от браузера
  const body = await request.json();

  // Пересылаем на RAG сервер (из контейнера)
  const response = await fetch(RAG_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await response.json());
}
```

**Health check:**
```bash
curl http://localhost:3000/api/rag
# Ответ: {"status":"ok","ragServer":{...}}
```

### 2. RAG Tools (Client-side)

**Файл:** [src/app/agentConfigs/severstalAssistantAgent/ragTools.ts](src/app/agentConfigs/severstalAssistantAgent/ragTools.ts)

```typescript
// Используем API proxy вместо прямого подключения
const RAG_API_PROXY = '/api/rag';

async function callRagServer(toolName: string, args: any) {
  // Этот код выполняется в браузере
  const response = await fetch(RAG_API_PROXY, {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });
  // ...
}
```

## Тестирование

### 1. Health Check
```bash
curl http://localhost:3000/api/rag
```

**Ожидаемый результат:**
```json
{
  "status": "ok",
  "ragServer": {
    "message": "LightRAG MCP HTTP Wrapper",
    "version": "1.0.0",
    "status": "running"
  },
  "proxyUrl": "/api/rag"
}
```

### 2. Полный RAG Query
```bash
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### 3. Через UI
1. Откройте https://rndaibot.ru/?agentConfig=chatSeverstalAssistant
2. Подключитесь к агенту
3. Задайте вопрос: "Расскажи о команде"
4. Проверьте консоль браузера - не должно быть ошибок Mixed Content

### 4. Логи сервера
```bash
docker compose logs -f realtime-agents | grep "RAG Proxy"
```

**Ожидаемый вывод:**
```
[RAG Proxy] Received request: { method: 'tools/call', toolName: 'lightrag_query' }
[RAG Proxy] Response received: { hasResult: true, contentLength: 842 }
```

## Отладка

### Проверка доступности RAG сервера из контейнера
```bash
docker compose exec realtime-agents wget -qO- http://host.docker.internal:8000
```

**Ожидается:**
```json
{"message":"LightRAG MCP HTTP Wrapper","version":"1.0.0","status":"running"}
```

### Проверка через тестовый endpoint
```bash
curl http://localhost:3000/api/test-mcp-tools | jq .
```

### Логи браузера
Откройте DevTools → Console и проверьте:
- ✅ Не должно быть ошибок "Mixed Content"
- ✅ Не должно быть ошибок "host.docker.internal"
- ✅ Должны быть логи `[RAG] Calling lightrag_query`

### Логи сервера
```bash
# Все RAG логи
docker compose logs realtime-agents | grep RAG

# Логи proxy
docker compose logs realtime-agents | grep "RAG Proxy"
```

## Общие проблемы

### 1. RAG сервер недоступен
**Ошибка:** `Error: connect ECONNREFUSED`

**Решение:**
- Убедитесь что RAG сервер запущен на порту 8000
- Проверьте: `curl http://localhost:8000`
- Если RAG сервер в Docker, проверьте что он в той же сети или на хосте

### 2. Timeout
**Ошибка:** `The operation was aborted due to timeout`

**Решение:**
- RAG запрос может занимать много времени для больших баз знаний
- Увеличьте timeout в [src/app/api/rag/route.ts:50](src/app/api/rag/route.ts#L50):
```typescript
signal: AbortSignal.timeout(60000), // 60 секунд
```

### 3. Empty response / "has no output"
**Ошибка:** `[MCP] Function call lightrag_query completed but has no output`

**Причина:** Tool function вернула `undefined` или пустую строку

**Решение:**
- Проверьте что RAG сервер возвращает валидный JSON
- Проверьте парсинг ответа в [ragTools.ts:40-47](src/app/agentConfigs/severstalAssistantAgent/ragTools.ts#L40-L47)

### 4. CORS ошибки
Если вы видите CORS ошибки, проверьте:
- API proxy должен быть на том же домене что и приложение
- Относительный URL `/api/rag` должен работать автоматически

## Ссылки

- [API Proxy Implementation](src/app/api/rag/route.ts)
- [RAG Tools Implementation](src/app/agentConfigs/severstalAssistantAgent/ragTools.ts)
- [RAG Setup Documentation](RAG_SETUP.md)
- [Test Endpoints](src/app/api/test-mcp-tools/route.ts)
