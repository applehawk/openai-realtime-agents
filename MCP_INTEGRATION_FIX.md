# Исправление ошибки "No existing trace found" при интеграции MCP серверов

## Проблема

При попытке подключить Google MCP сервер к OpenAI Realtime API возникала ошибка:
```
Error: No existing trace found
```

Эта ошибка происходила в `RealtimeSession` при попытке создать сессию с MCP серверами, которые были добавлены в `routerAgent.mcpServers` **до** вызова `session.connect()`.

### Причина

Согласно [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580), это известный баг в OpenAI Agents SDK v0.3.0:

- Trace context создается только **во время** `session.connect()`
- SDK пытается создать spans для MCP серверов **до** того, как trace context существует
- Результат: ошибка "No existing trace found"

### Корневая причина

Согласно документации OpenAI Agents SDK, правильная последовательность работы с MCP серверами:

1. Создать `MCPServerStreamableHttp` instance
2. Вызвать `server.connect()` для подключения к серверу
3. **Только после этого** передать подключенный сервер в конструктор `RealtimeAgent`

**Неправильно** (как было):
```javascript
const routerAgent = new RealtimeAgent({ mcpServers: [] });
// ... позже
routerAgent.mcpServers = [mcpServer]; // ❌ Добавление после создания
// ... еще позже
const session = new RealtimeSession(routerAgent); // ❌ Ошибка!
```

**Правильно** (как стало):
```javascript
const mcpServer = new MCPServerStreamableHttp({ url: '...' });
await mcpServer.connect(); // ✅ Подключаем СНАЧАЛА
const routerAgent = new RealtimeAgent({ mcpServers: [mcpServer] }); // ✅ Передаем при создании
const session = new RealtimeSession(routerAgent); // ✅ Работает!
```

## Решение

### Изменения в архитектуре

#### 1. Динамическое создание Agent с MCP серверами

**Файл**: [routerAgent.ts](src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts)

- Создана функция `createRouterAgent(mcpServers)` для динамического создания agent
- Изменена `initializeMCPServersBeforeAgent()`:
  - Возвращает `RealtimeAgent | null` вместо `boolean`
  - Создает и подключает MCP сервер через `mcpServerManager.fetchAndInitialize()`
  - **Пересоздает** `routerAgent` с подключенным MCP сервером
  - Возвращает новый agent instance

```typescript
export async function initializeMCPServersBeforeAgent(): Promise<RealtimeAgent | null> {
  // Step 1: Create and connect MCP server
  const mcpServer = await mcpServerManager.fetchAndInitialize();

  if (!mcpServer || !mcpServerManager.isServerConnected()) {
    return null;
  }

  // Step 2: Recreate agent WITH connected MCP server
  const newAgent = createRouterAgent([mcpServer]);

  // Step 3: Update exported reference
  routerAgent = newAgent;
  currentRouterAgent = newAgent;

  return newAgent;
}
```

#### 2. Использование getCurrentRouterAgent() в App

**Файл**: [App.tsx](src/app/App.tsx:270)

- Импортирована функция `getCurrentRouterAgent()`
- В `connectToRealtime()` используется актуальный agent с MCP серверами:

```typescript
const connectToRealtime = async () => {
  // Get current agent (with MCP servers after initialization)
  const currentRouterAgent = getCurrentRouterAgent();

  await connect({
    getEphemeralKey: async () => EPHEMERAL_KEY,
    initialAgents: [currentRouterAgent], // ✅ Agent с MCP серверами
    // ...
  });
};
```

#### 3. Обновление UserProfile

**Файл**: [UserProfile.tsx](src/app/components/UserProfile.tsx:233)

```typescript
const agentWithMcp = await initializeMCPServersBeforeAgent();

if (!agentWithMcp) {
  throw new Error('MCP initialization failed');
}

// Dispatch event to trigger Realtime connection
window.dispatchEvent(new CustomEvent('mcp:ready'));
```

### Новая последовательность инициализации

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User нажимает "Start MCP Container" в UI                  │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Контейнер запускается и становится healthy                │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. initializeMCPServersBeforeAgent() вызывается             │
│    - mcpServerManager.fetchAndInitialize()                   │
│    - Создается MCPServerStreamableHttp instance              │
│    - Вызывается server.connect()                             │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. RouterAgent ПЕРЕСОЗДАЕТСЯ с подключенным MCP сервером     │
│    - createRouterAgent([mcpServer])                          │
│    - routerAgent = newAgent                                  │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Отправляется событие 'mcp:ready'                         │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. App.tsx получает событие и вызывает connectToRealtime()  │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. getCurrentRouterAgent() возвращает agent с MCP серверами  │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. RealtimeSession создается с agent, у которого УЖЕ есть   │
│    подключенные MCP серверы                                  │
└───────────────────┬──────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. session.connect() успешно завершается                     │
│    БЕЗ ошибки "No existing trace found" ✅                   │
└──────────────────────────────────────────────────────────────┘
```

## Проксирование через Nginx

MCP сервер доступен через nginx proxy:

```
OpenAI Realtime API
    ↓
https://rndaibot.ru/mcp/{username}/mcp (SSL)
    ↓
Nginx Reverse Proxy
    ↓
mcpgoogle-{username}:8000 (Docker network)
    ↓
Google MCP Server
```

### Конфигурация URL

**Файл**: [mcpServerManager.ts:49](src/app/agentConfigs/severstalAssistantAgent/libs/mcpServerManager.ts#L49)

```typescript
const containerName = 'mcpgoogle-mr.vasilenko.vlad';
const username = containerName.replace('mcpgoogle-', ''); // 'mr.vasilenko.vlad'
const publicUrl = `https://rndaibot.ru/mcp/${username}/mcp`;

const mcpServer = new MCPServerStreamableHttp({
  url: publicUrl, // ✅ Публичный HTTPS URL для OpenAI
  name: containerName,
  cacheToolsList: true,
});
```

## Тестирование

### Запуск prod окружения

```bash
cd /home/vladmac/dev/oma-frontend
make prod
```

### Тест Google MCP интеграции

```bash
# 1. Получить access_token:
#    - Откройте https://rndaibot.ru
#    - Залогиньтесь
#    - DevTools → Application → Cookies → access_token

# 2. Запустить тест:
ACCESS_TOKEN=your_token_here node test-mcp-google.js
```

Тест проверяет:
- ✅ Статус контейнера через `/api/containers/status`
- ✅ Конструирование MCP URL (как в mcpServerManager)
- ✅ Подключение к MCP SSE endpoint
- ✅ Получение списка tools через `/api/mcp/tools`

### Ручная проверка через curl

```bash
# 1. Проверить статус контейнера
curl -s https://rndaibot.ru/api/containers/status \
  -H "Cookie: access_token=YOUR_TOKEN" | jq

# 2. Проверить MCP tools
curl -s https://rndaibot.ru/api/mcp/tools \
  -H "Cookie: access_token=YOUR_TOKEN" | jq

# 3. Проверить MCP server endpoint
# ⚠️ ВАЖНО: Сервер требует оба Accept типа: application/json, text/event-stream
curl -X POST https://rndaibot.ru/mcp/mr.vasilenko.vlad/mcp \
  -H "Cookie: access_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    }
  }'
```

## Файлы, которые были изменены

1. **[routerAgent.ts](src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts)**
   - Создана `createRouterAgent(mcpServers)`
   - Обновлена `initializeMCPServersBeforeAgent()` → возвращает `RealtimeAgent | null`
   - Обновлена `cleanupMCPServer()` → пересоздает agent без MCP
   - Добавлена `getCurrentRouterAgent()` → возвращает текущий instance

2. **[index.ts](src/app/agentConfigs/severstalAssistantAgent/index.ts)**
   - Экспортирована `getCurrentRouterAgent()`
   - Обновлены комментарии

3. **[UserProfile.tsx](src/app/components/UserProfile.tsx#L233)**
   - Обработка `RealtimeAgent | null` от `initializeMCPServersBeforeAgent()`
   - Добавлено логирование

4. **[App.tsx](src/app/App.tsx#L270)**
   - Импорт `getCurrentRouterAgent()`
   - Использование `getCurrentRouterAgent()` вместо статического `chatSeverstalAssistantScenario`

## Ссылки

- [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580) - Официальный баг репорт
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) - Документация
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol

## Статус

✅ **Проблема решена**

Теперь MCP серверы правильно инициализируются ПЕРЕД созданием RealtimeSession, и ошибка "No existing trace found" больше не возникает.
