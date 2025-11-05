# MCP Server Integration

## Overview

MCP (Model Context Protocol) сервер подключается **до загрузки агента** после авторизации пользователя в Google. Сервер работает в Docker контейнере и предоставляет доступ к Google Calendar и Gmail.

**Важно:** MCP сервер должен быть инициализирован ДО первого использования агента, чтобы корректно загрузить все MCP tools согласно документации OpenAI Agents.

## Архитектура

### Компоненты

1. **MCPServerManager** (`src/app/agentConfigs/severstalAssistantAgent/libs/mcpServerManager.ts`)
   - Управляет lifecycle MCP сервера
   - Получает информацию о контейнере через API
   - Создает `MCPServerStreamableHttp` с `cacheToolsList: true` для оптимизации
   - Вызывает `connect()` перед использованием

2. **Router Agent** (`src/app/agentConfigs/severstalAssistantAgent/agents/routerAgent.ts`)
   - Создается один раз при загрузке модуля
   - Ссылается на массив `mcpServers`, который заполняется через `initializeMCPServersBeforeAgent()`
   - Экспортирует функции `initializeMCPServersBeforeAgent()` и `cleanupMCPServer()`

3. **App Component** (`src/app/App.tsx`)
   - Вызывает `initializeMCPServersBeforeAgent()` в начале `connectToRealtime()`
   - Гарантирует, что MCP сервер подключен ДО создания Realtime сессии

## Workflow

### Initial Load (Container Already Running)
```
User Authentication
        ↓
User clicks Connect / App auto-connects
        ↓
connectToRealtime() called
        ↓
initializeMCPServersBeforeAgent() executed
        ↓
GET /api/containers/status
        ↓
{ running: true, port: 3002 } ?
        ↓
YES → MCPServerStreamableHttp created with cacheToolsList: true
        ↓
mcpServer.connect()
        ↓
mcpServer added to mcpServers[] array
        ↓
Realtime session created with SDK
        ↓
Agent can use MCP tools (Gmail, Calendar)
```

### Manual Container Start
```
User clicks "Start Container" in UserProfile
        ↓
POST /api/containers/start
        ↓
Container starts successfully
        ↓
User needs to reconnect Realtime session
        ↓
connectToRealtime() called again
        ↓
initializeMCPServersBeforeAgent() executes
        ↓
MCP server connected and added to mcpServers[]
        ↓
Realtime session created with MCP tools available
```

### Container Stop / Google Disconnect
```
User stops container or disconnects Google
        ↓
cleanupMCPServer() called
        ↓
mcpServer.close()
        ↓
mcpServers[] array cleared
        ↓
MCP tools no longer available
```

## API Endpoints

### GET /api/containers/status

Возвращает статус Docker контейнера с MCP сервером.

**Response:**
```json
{
  "status": "running",
  "running": true,
  "port": 3002,
  "health": "healthy",
  "container_id": "d5eaf898373a",
  "container_name": "mcpgoogle"
}
```

## Usage

### Automatic Initialization (Recommended)

MCP сервер автоматически инициализируется в `App.tsx` перед созданием Realtime сессии:

```typescript
// In App.tsx
import { initializeMCPServersBeforeAgent } from "@/app/agentConfigs/severstalAssistantAgent";

const connectToRealtime = async () => {
  // Initialize MCP servers BEFORE creating the session
  await initializeMCPServersBeforeAgent();

  // Then create Realtime session
  await connect({
    getEphemeralKey: async () => EPHEMERAL_KEY,
    initialAgents: reorderedAgents,
    // ...
  });
};
```

### Manual Initialization

Вы можете вручную инициализировать MCP сервер, если нужно:

```typescript
import {
  initializeMCPServersBeforeAgent,
  cleanupMCPServer,
  mcpServerManager,
} from "@/app/agentConfigs/severstalAssistantAgent";

// Initialize before using agent
const success = await initializeMCPServersBeforeAgent();

// Check status
const isConnected = mcpServerManager.isServerConnected();
const containerStatus = mcpServerManager.getContainerStatus();

// Cleanup
await cleanupMCPServer();
```

### Custom Container Status

Если у вас уже есть информация о контейнере:

```typescript
import { mcpServerManager } from "@/app/agentConfigs/severstalAssistantAgent";

const containerStatus = {
  status: "running",
  running: true,
  port: 3002,
  health: "healthy",
  container_id: "d5eaf898373a",
  container_name: "mcpgoogle",
};

const mcpServer = await mcpServerManager.initialize(containerStatus);
```

## Configuration

### Docker Networking

Frontend работает в Docker контейнере и подключается к MCP контейнерам на хосте через `host.docker.internal`.

**docker-compose.yml** (frontend):
```yaml
environment:
  - DOCKER_ENV=true  # Включает использование host.docker.internal
  - NODE_ENV=production
extra_hosts:
  - "host.docker.internal:host-gateway"  # Маппинг для доступа к хосту
```

### MCP Container Architecture

```
┌─────────────────────┐
│  Frontend Container │
│  (Next.js App)      │
│  Port: 3000         │
└──────────┬──────────┘
           │
           │ http://host.docker.internal:3002
           ↓
┌─────────────────────┐
│   Docker Host       │
│   Port: 3002 → 8000 │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  MCP Container      │
│  mcpgoogle-username │
│  Port: 8000         │
└─────────────────────┘
```

**Как работает:**
1. Backend создает контейнер для пользователя: `docker run -p 3002:8000 mcpgoogle-username`
2. Frontend получает порт через `/api/containers/status`
3. Frontend подключается: `http://host.docker.internal:3002`
4. Docker перенаправляет на контейнер MCP

### Environment Variables

- `DOCKER_ENV=true` - использовать `host.docker.internal` для Docker окружения
- `NODE_ENV=production` - альтернативный способ определения Docker окружения

**В development** (без Docker):
- Используется `localhost` вместо `host.docker.internal`
- Контейнер должен быть доступен на `localhost:PORT`

## Troubleshooting

### MCP Server не подключается

1. Проверьте, что контейнер запущен:
   ```bash
   docker ps | grep mcpgoogle
   ```

2. Проверьте порт на хосте:
   ```bash
   curl http://localhost:3002/health
   ```

3. Если в Docker, проверьте через host.docker.internal:
   ```bash
   docker exec openai-realtime-agents curl http://host.docker.internal:3002/health
   ```

4. Проверьте API endpoint:
   ```bash
   curl http://localhost:3000/api/containers/status
   ```

5. Проверьте логи frontend:
   ```bash
   docker logs openai-realtime-agents
   ```
   Ищите: `[MCPServerManager] Creating MCP server: http://...`

### Docker Networking Issues

**Симптом:** `Failed to connect to MCP server`

**Решение:**
1. Убедитесь, что `DOCKER_ENV=true` в docker-compose.yml
2. Проверьте `extra_hosts` конфигурацию
3. Проверьте, что порт MCP контейнера проброшен на хост:
   ```bash
   docker port mcpgoogle-username
   ```

**Симптом:** `Connection refused`

**Возможные причины:**
- MCP контейнер не запущен
- Порт не проброшен корректно
- Firewall блокирует соединение

**Проверка:**
```bash
# Проверить статус контейнера
docker ps | grep mcpgoogle

# Проверить healthcheck
docker inspect mcpgoogle-username | grep -A 5 Health

# Проверить логи контейнера
docker logs mcpgoogle-username
```

## Migration from hostedMcpTool

### Before (Static URL):
```typescript
import { hostedMcpTool } from '@openai/agents';

hostedMcpTool({
  serverLabel: 'calendar',
  serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
})
```

### After (Dynamic URL):
```typescript
import { MCPServerStreamableHttp } from '@openai/agents';
import { mcpServerManager } from './libs/mcpServerManager';

// Automatically gets port and container info from /api/containers/status
await mcpServerManager.fetchAndInitialize();
```
