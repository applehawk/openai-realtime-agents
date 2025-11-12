# Исправление MCP интеграции - Итоги

## ✅ Что было исправлено

Устранена критическая ошибка **"No existing trace found"** при подключении Google MCP сервера к OpenAI Realtime API.

### Причина проблемы

OpenAI Agents SDK v0.3.0 требует, чтобы MCP серверы были:
1. Созданы (`new MCPServerStreamableHttp()`)
2. Подключены (`server.connect()`)
3. **Переданы в конструктор Agent ДО создания RealtimeSession**

Раньше мы добавляли MCP серверы ПОСЛЕ создания agent, что вызывало ошибку trace context.

## 📝 Измененные файлы

### 1. [routerAgent.ts](src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts)
- ✅ Создана функция `createRouterAgent(mcpServers)` для динамического создания agent
- ✅ `initializeMCPServersBeforeAgent()` теперь **пересоздает** agent с MCP серверами
- ✅ Возвращает `RealtimeAgent | null` вместо `boolean`
- ✅ Добавлена `getCurrentRouterAgent()` для получения актуального instance

### 2. [App.tsx](src/app/App.tsx#L270)
- ✅ Использует `getCurrentRouterAgent()` вместо статического сценария
- ✅ Гарантирует, что RealtimeSession создается с agent, у которого УЖЕ есть MCP серверы

### 3. [UserProfile.tsx](src/app/components/UserProfile.tsx#L233)
- ✅ Обрабатывает новый возвращаемый тип `RealtimeAgent | null`
- ✅ Добавлено детальное логирование процесса инициализации

### 4. [test-mcp-server/page.tsx](src/app/test-mcp-server/page.tsx)
- ✅ Обновлена логика `handleInitializeMCP()` для соответствия `mcpServerManager`
- ✅ Добавлены пошаговые тесты: container → URL → SSE → tools
- ✅ Показывает детальную информацию о проксировании через nginx

### 5. [test-mcp-google.js](test-mcp-google.js) *(новый файл)*
- ✅ Node.js скрипт для тестирования MCP через API
- ✅ Использует те же принципы, что и `mcpServerManager.ts`

## 🔄 Новая последовательность инициализации

```
User → Start Container
  ↓
Container → healthy
  ↓
initializeMCPServersBeforeAgent()
  ├─ Fetch container status
  ├─ Create MCPServerStreamableHttp
  ├─ Call server.connect() ✅
  └─ RECREATE routerAgent with MCP servers ✅
  ↓
Dispatch 'mcp:ready' event
  ↓
App.tsx → connectToRealtime()
  ├─ getCurrentRouterAgent() ✅ returns agent WITH MCP
  └─ new RealtimeSession(agentWithMCP)
  ↓
session.connect() → SUCCESS ✅
```

## 🧪 Тестирование

### 1. Сборка и запуск prod

```bash
cd /home/vladmac/dev/oma-frontend
make prod
```

### 2. Web UI тест (через браузер)

```
1. Откройте https://rndaibot.ru/test-mcp-server
2. Нажмите "Start Container" (если еще не запущен)
3. Дождитесь healthy status
4. Нажмите "Initialize MCP"
5. Проверьте результаты в Test Results панели
```

Тест покажет:
- ✅ Container Status
- ✅ MCP URL Generated (`https://rndaibot.ru/mcp/{username}/mcp`)
- ✅ MCP SSE Connection
- ✅ MCP Tools Retrieved (список всех доступных tools)

### 3. Node.js тест (через командную строку)

```bash
# 1. Получить access_token
#    DevTools → Application → Cookies → access_token

# 2. Запустить тест
ACCESS_TOKEN=your_token_here node test-mcp-google.js
```

Тест проверяет:
- ✅ `/api/containers/status` - статус контейнера
- ✅ Конструирование MCP URL (как в mcpServerManager)
- ✅ SSE подключение к MCP серверу
- ✅ `/api/mcp/tools` - список инструментов

### 4. Ручная проверка через curl

```bash
# Статус контейнера
curl -s https://rndaibot.ru/api/containers/status \
  -H "Cookie: access_token=YOUR_TOKEN" | jq

# MCP tools
curl -s https://rndaibot.ru/api/mcp/tools \
  -H "Cookie: access_token=YOUR_TOKEN" | jq

# Прямой тест MCP endpoint
# ⚠️ ВАЖНО: Сервер требует оба типа в Accept: application/json, text/event-stream
curl -X POST https://rndaibot.ru/mcp/mr.vasilenko.vlad/mcp \
  -H "Cookie: access_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## 🌐 Nginx проксирование

MCP сервер доступен через HTTPS proxy:

```
OpenAI Realtime API
    ↓
https://rndaibot.ru/mcp/{username}/mcp (SSL terminat ion)
    ↓
Nginx Reverse Proxy (rndaibot.ru)
    ↓
mcpgoogle-{username}:8000 (Docker network)
    ↓
Google MCP Server (SSE endpoint)
```

### URL конструирование

**Логика**: [mcpServerManager.ts:49](src/app/agentConfigs/severstalAssistantAgent/libs/mcpServerManager.ts#L49)

```typescript
// Извлекаем username из имени контейнера
const containerName = 'mcpgoogle-mr.vasilenko.vlad';
const username = containerName.replace('mcpgoogle-', '');

// Создаем публичный HTTPS URL
const publicUrl = `https://rndaibot.ru/mcp/${username}/mcp`;

// OpenAI Realtime API использует этот URL
const mcpServer = new MCPServerStreamableHttp({ url: publicUrl });
```

## 📊 Результат

### До исправления ❌
```javascript
const routerAgent = new RealtimeAgent({ mcpServers: [] });
// ... позже
routerAgent.mcpServers = [mcpServer]; // ❌ Добавление после создания
const session = new RealtimeSession(routerAgent);
await session.connect(); // ❌ Error: No existing trace found
```

### После исправления ✅
```javascript
const mcpServer = await mcpServerManager.fetchAndInitialize();
await mcpServer.connect(); // ✅ Подключаем СНАЧАЛА
const routerAgent = createRouterAgent([mcpServer]); // ✅ Передаем при создании
const session = new RealtimeSession(routerAgent);
await session.connect(); // ✅ SUCCESS!
```

## 🔗 Полезные ссылки

- [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580) - Баг репорт
- [MCP_INTEGRATION_FIX.md](MCP_INTEGRATION_FIX.md) - Детальная техническая документация
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## ✨ Финальный статус

✅ **Проблема полностью решена**

MCP серверы теперь корректно:
1. Создаются и подключаются через `connect()`
2. Передаются в Agent при его создании
3. Используются в RealtimeSession без ошибок

Ошибка **"No existing trace found"** больше не возникает! 🎉
