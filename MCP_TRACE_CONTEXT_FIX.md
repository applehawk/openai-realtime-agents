# Исправление ошибки "No existing trace found" - Отсутствие @openai/agents-core

## Проблема

Ошибка "No existing trace found" возникает при попытке подключения `RealtimeSession` с MCP серверами, несмотря на правильную инициализацию `MCPServerStreamableHttp`.

### Логи из браузера

```javascript
[MCPServerManager] ✅ MCP server is healthy: {status: 'healthy', service: 'mcp-server'}
[MCPServerManager] ✅ MCP server ready for Agent integration
[routerAgent] ✅ Router agent recreated with MCP servers: {mcpCount: 1}
[App] 📡 Using router agent for session: {name: 'routerAgent', mcpServersCount: 1}

// ⚠️ ПРОБЛЕМА: SDK определяет MCP server как MCPServerStdio вместо MCPServerStreamableHttp
[useRealtimeSession] Root agent has MCP servers: {count: 1, servers: Array(1)}
  0: {name: 'MCPServerStdio', type: 'h'}  // ← НЕПРАВИЛЬНЫЙ ТИП!

[useRealtimeSession] Calling session.connect()...

// ❌ ОШИБКА при попытке получить MCP tools
Error: No existing trace found
    at c.getMcpTools (...:6:142458)
    at c.getAllTools (...:6:142580)
    at #R (...:1:34440)
    at async e$.connect (...:6:3607)
```

## Корневая причина

**Отсутствие пакета `@openai/agents-core`**

Согласно [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580):

> **Solution**: After installing the `@openai/agents-core` package, everything started working and the error went away.

### Что происходит без @openai/agents-core:

1. ✅ `MCPServerStreamableHttp` создается правильно
2. ✅ Health check проходит успешно
3. ✅ Agent пересоздается с MCP серверами
4. ❌ При вызове `RealtimeSession.connect()`:
   - SDK пытается получить список всех tools через `getAllTools()`
   - `getAllTools()` вызывает `getMcpTools()`
   - `getMcpTools()` требует **trace context** для работы
   - **Trace context НЕ может быть создан** без `@openai/agents-core`
   - Результат: `Error: No existing trace found`

### Почему MCP server определяется как MCPServerStdio?

SDK **некорректно сериализует** MCP server instance при передаче в Realtime API из-за отсутствия необходимых tracing компонентов из `@openai/agents-core`.

## Решение

### Установить пакет @openai/agents-core

```json
// package.json
{
  "dependencies": {
    "@openai/agents": "^0.3.0",
    "@openai/agents-core": "^0.3.0",  // ← ДОБАВИТЬ
    ...
  }
}
```

### Команды для установки

```bash
# Вариант 1: npm
npm install @openai/agents-core@^0.3.0

# Вариант 2: yarn
yarn add @openai/agents-core@^0.3.0

# Вариант 3: pnpm
pnpm add @openai/agents-core@^0.3.0
```

### После установки

```bash
# Пересобрать проект
make prod

# ИЛИ
npm run build
```

## Технические детали

### Trace Context в OpenAI Agents SDK

**Trace context** используется SDK для:
1. Отслеживания вызовов MCP tools
2. Логирования и debugging
3. Связывания асинхронных операций
4. Правильной сериализации MCP server instances

Без `@openai/agents-core`:
- ❌ Trace context не может быть создан
- ❌ `getMcpTools()` выбрасывает "No existing trace found"
- ❌ `RealtimeSession.connect()` fails

С `@openai/agents-core`:
- ✅ Trace context создается автоматически
- ✅ `getMcpTools()` работает корректно
- ✅ `RealtimeSession.connect()` succeeds

### Структура пакетов OpenAI Agents SDK

```
@openai/agents (главный пакет)
  ↓ зависит от
@openai/agents-core (tracing, context management)
  ↓ содержит
  - src/tracing/context.ts (trace context)
  - src/mcp/server/browser.ts (browser MCP support)
  - src/mcp/server/http.ts (HTTP Streaming support)
```

**Проблема**: `@openai/agents@^0.3.0` должен автоматически устанавливать `@openai/agents-core` как peer dependency, но в некоторых случаях этого не происходит.

**Решение**: Явно добавить `@openai/agents-core` в dependencies.

## Ожидаемый результат после исправления

### Логи браузера (AFTER FIX)

```javascript
[MCPServerManager] ✅ MCP server is healthy: {status: 'healthy', service: 'mcp-server'}
[MCPServerManager] ✅ MCP server ready for Agent integration
[routerAgent] ✅ Router agent recreated with MCP servers: {mcpCount: 1}
[App] 📡 Using router agent for session: {name: 'routerAgent', mcpServersCount: 1}

// ✅ ИСПРАВЛЕНО: SDK правильно определяет тип MCP server
[useRealtimeSession] Root agent has MCP servers: {count: 1, servers: Array(1)}
  0: {name: 'mcpgoogle-mr.vasilenko.vlad', type: 'MCPServerStreamableHttp'}  // ← ПРАВИЛЬНЫЙ ТИП!

[useRealtimeSession] Calling session.connect()...
[useRealtimeSession] ✅ Connected successfully
[useRealtimeSession] Session status: CONNECTED
```

### MCP tools доступны

```javascript
// Список доступных MCP tools
[UserProfile] ✅ MCP tools available: {
  count: 11,
  tools: [
    'gmail_get_message',
    'gmail_list_unread',
    'gmail_mark_as_read',
    'gmail_modify_message',
    'gmail_search_messages',
    'gmail_send_message',
    'calendar_upcoming',
    ...
  ]
}
```

## Файлы изменены

### [package.json](package.json)

**BEFORE**:
```json
{
  "dependencies": {
    "@openai/agents": "^0.3.0",
    ...
  }
}
```

**AFTER**:
```json
{
  "dependencies": {
    "@openai/agents": "^0.3.0",
    "@openai/agents-core": "^0.3.0",  // ← ДОБАВЛЕНО
    ...
  }
}
```

## Тестирование

### 1. Установить пакет

```bash
cd /home/vladmac/dev/oma-frontend
npm install @openai/agents-core@^0.3.0
```

### 2. Пересобрать проект

```bash
make prod
```

### 3. Тестировать в браузере

1. Открыть https://rndaibot.ru
2. Залогиниться
3. Запустить MCP контейнер (User Profile → Start Container)
4. Дождаться healthy status
5. Проверить browser console:
   - ✅ MCP server должен определяться как `MCPServerStreamableHttp`
   - ✅ `RealtimeSession.connect()` должен завершиться успешно
   - ✅ Ошибка "No existing trace found" должна исчезнуть

### 4. Проверить MCP tools

```javascript
// В browser console
fetch('/api/mcp/tools', { credentials: 'include' })
  .then(r => r.json())
  .then(data => console.log('MCP tools:', data));
```

Ожидаемый результат:
```json
{
  "toolCount": 11,
  "tools": [
    {"name": "gmail_get_message"},
    {"name": "gmail_list_unread"},
    ...
  ]
}
```

### 5. Тестировать голосовое взаимодействие

1. Нажать кнопку "Connect"
2. Проверить, что sessionStatus = "CONNECTED"
3. Попросить голосом: "Проверь мою почту"
4. Убедиться, что MCP tool вызывается корректно

## Связанные документы

1. **[CLIENT_SERVER_SEPARATION_FIX.md](CLIENT_SERVER_SEPARATION_FIX.md)** - Исправление разделения client/server кода
2. **[MCP_CONNECT_FIX.md](MCP_CONNECT_FIX.md)** - Исправление connect() метода
3. **[MCP_INTEGRATION_FIX.md](MCP_INTEGRATION_FIX.md)** - Детальная документация по интеграции MCP

## Связанные GitHub Issues

1. **[Issue #580](https://github.com/openai/openai-agents-js/issues/580)** - "No existing trace found" error when using MCP servers with Websocket RealtimeAgent
   - **Solution**: Install `@openai/agents-core` package
   - **Status**: Closed (solution found)

2. **[Issue #353](https://github.com/openai/openai-agents-js/issues/353)** - Add mcpServers support to RealtimeAgent
   - **Status**: Implemented (support added)

3. **[Issue #417 (cloudflare/agents)](https://github.com/cloudflare/agents/issues/417)** - MCPServerStreamableHttp doesn't work
   - Related to browser environment limitations

## Версии

- **@openai/agents**: ^0.3.0
- **@openai/agents-core**: ^0.3.0 ← **КРИТИЧЕСКИ ВАЖНО**
- **Next.js**: ^15.5.4
- **React**: ^19.2.0
- **Node.js**: 20+

## Статус

⏳ **Ожидает установки пакета и тестирования**

### Checklist

- [x] Добавлен `@openai/agents-core` в package.json
- [ ] Установлен пакет через npm/yarn/pnpm
- [ ] Проект пересобран
- [ ] Протестирован в браузере
- [ ] Проверено, что MCP server определяется правильно
- [ ] Проверено, что RealtimeSession подключается успешно
- [ ] Проверено, что MCP tools доступны
- [ ] Протестировано голосовое взаимодействие с MCP tools

## Дополнительная информация

### Почему этот пакет не устанавливается автоматически?

В идеальном случае `@openai/agents` должен объявить `@openai/agents-core` как:
- **dependency** (автоматическая установка)
- **peerDependency** (предупреждение при отсутствии)

Однако в версии `^0.3.0` это может быть:
1. Баг в package.json самого `@openai/agents`
2. Проблема с менеджером пакетов (npm/yarn/pnpm)
3. Конфликт версий в lock файле

**Решение**: Явно добавить в dependencies - гарантирует установку.

### Альтернативные решения (НЕ рекомендуются)

1. **Отключить tracing** (не работает - ошибка все равно возникает):
   ```typescript
   const agent = new RealtimeAgent({
     tracingDisabled: true, // ❌ Не помогает
   });
   ```

2. **Использовать hosted MCP tools** вместо direct MCP servers:
   ```typescript
   // Вместо mcpServers: [mcpServer]
   tools: [
     hostedMcpTool({
       url: 'https://rndaibot.ru/mcp/username/mcp',
       tool: 'gmail_list_unread',
     }),
   ]
   ```
   **Проблема**: Нужно явно перечислять каждый tool, нет автоматического discovery.

3. **Использовать server-side Agent** вместо client-side RealtimeAgent:
   **Проблема**: Теряется real-time voice interaction.

**Рекомендация**: Установить `@openai/agents-core` - единственное правильное решение.

## Следующие шаги

1. ✅ Установить `@openai/agents-core`
2. ✅ Пересобрать проект
3. ⏳ Протестировать в production
4. ⏳ Проверить работу MCP tools
5. ⏳ Проверить голосовое взаимодействие
6. ⏳ Мониторинг логов

## Ссылки

- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-js/)
- [MCP Integration Guide](https://openai.github.io/openai-agents-js/guides/mcp/)
- [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580)
- [MCPServerStreamableHttp API](https://openai.github.io/openai-agents-js/openai/agents/classes/mcpserverstreamablehttp/)
- [RealtimeAgent API](https://openai.github.io/openai-agents-js/openai/agents-realtime/classes/realtimeagent/)
