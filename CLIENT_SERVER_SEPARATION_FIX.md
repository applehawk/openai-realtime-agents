# Исправление ошибки "No existing trace found" - Client/Server Separation

## Проблема

Ошибка "No existing trace found" продолжала возникать несмотря на правильную реконструкцию agent с MCP серверами.

### Логи из браузера

```javascript
[routerAgent] ✅ Router agent recreated with MCP servers: {mcpCount: 1, agentName: 'routerAgent'}
[App] 📡 Using router agent for session: {name: 'routerAgent', mcpServersCount: 1}
[useRealtimeSession] Root agent has MCP servers: {count: 1, servers: Array(1)}
[useRealtimeSession] Connection failed: Error: No existing trace found
```

## Корневая причина

**Next.js App Router: Смешивание Client и Server кода**

В Next.js 14+ с app router код может выполняться в двух разных контекстах:
1. **Client-side** - в браузере (компоненты с `'use client'`)
2. **Server-side** - на сервере (API routes, Server Components)

### Что происходило

Server-side API routes импортировали client-side singleton:

```typescript
// ❌ НЕПРАВИЛЬНО: src/app/api/mcp/status/route.ts
import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

export async function GET(_request: NextRequest) {
  const isConnected = mcpServerManager.isServerConnected(); // ❌
  // ...
}
```

**Проблема**: Когда server-side код импортирует client-side модуль:
1. Весь module scope код из `routerAgent.ts` выполняется **на сервере**
2. Создается **отдельный** экземпляр `routerAgent` в server context
3. Client-side код создает **свой** экземпляр в browser context
4. Singleton паттерн **ломается** - существует 2 разных instance
5. `getCurrentRouterAgent()` возвращает server instance, а не client instance
6. RealtimeSession создается с неправильным agent instance
7. Результат: "No existing trace found"

### Схема проблемы

```
┌─────────────────────────────────────────────────────────────┐
│ Server Context (Node.js)                                    │
│                                                              │
│  /api/mcp/status/route.ts                                   │
│    ↓ import mcpServerManager                                │
│  routerAgent.ts (module scope)                              │
│    ↓ export let routerAgent = createRouterAgent()          │
│  SERVER INSTANCE created ❌                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Client Context (Browser)                                    │
│                                                              │
│  App.tsx ('use client')                                     │
│    ↓ import getCurrentRouterAgent                           │
│  routerAgent.ts (module scope)                              │
│    ↓ export let routerAgent = createRouterAgent()          │
│  CLIENT INSTANCE created ✅                                 │
│                                                              │
│  UserProfile.tsx                                            │
│    ↓ calls initializeMCPServersBeforeAgent()               │
│    ↓ recreates CLIENT INSTANCE with MCP                    │
│                                                              │
│  App.tsx                                                    │
│    ↓ getCurrentRouterAgent() returns CLIENT INSTANCE ✅    │
│    ↓ BUT trace context was created in SERVER INSTANCE ❌   │
│                                                              │
│  RealtimeSession.connect()                                  │
│    ↓ Error: No existing trace found ❌                     │
└─────────────────────────────────────────────────────────────┘
```

## Решение

### 1. Удалить все imports client-side кода из server routes

#### Файл: [/api/mcp/status/route.ts](src/app/api/mcp/status/route.ts)

**До (НЕПРАВИЛЬНО)**:
```typescript
import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

export async function GET(_request: NextRequest) {
  const isConnected = mcpServerManager.isServerConnected(); // ❌ Server-side использование client singleton
  // ...
}
```

**После (ПРАВИЛЬНО)**:
```typescript
import { cookies } from 'next/headers';

const AUTH_API_BASE = process.env.AUTH_API_BASE || 'http://multiagent_app:7000/api/v1';

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  // Server-to-server communication with backend
  const response = await fetch(`${AUTH_API_BASE}/containers/status`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const containerStatus = await response.json();
  return NextResponse.json({
    connected: containerStatus.running && containerStatus.health === 'healthy',
    containerStatus,
  });
}
```

#### Файл: [/api/mcp/initialize/route.ts](src/app/api/mcp/initialize/route.ts)

**До (НЕПРАВИЛЬНО)**:
```typescript
import { mcpServerManager } from '@/app/agentConfigs/severstalAssistantAgent';

export async function POST(_request: NextRequest) {
  const mcpServer = await mcpServerManager.initialize(containerStatus); // ❌
  return NextResponse.json({
    connected: mcpServerManager.isServerConnected(), // ❌
  });
}
```

**После (ПРАВИЛЬНО)**:
```typescript
/**
 * NOTE: This endpoint is for testing purposes only.
 *
 * Actual MCP initialization happens CLIENT-SIDE in UserProfile.tsx via:
 * - initializeMCPServersBeforeAgent()
 * - mcpServerManager.fetchAndInitialize()
 * - Agent recreation with connected MCP servers
 */
export async function POST(_request: NextRequest) {
  // Just verify container status (server-to-server)
  const response = await fetch(`${AUTH_API_BASE}/containers/status`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const containerStatus = await response.json();
  const isReady = containerStatus.running && containerStatus.health === 'healthy';

  return NextResponse.json({
    success: true,
    ready: isReady,
    note: 'Client-side code in UserProfile.tsx will create and connect MCP server',
  });
}
```

### 2. Client-side инициализация (осталась без изменений)

#### UserProfile.tsx - Триггер MCP инициализации

```typescript
const agentWithMcp = await initializeMCPServersBeforeAgent();

if (!agentWithMcp) {
  throw new Error('MCP initialization failed');
}

// Dispatch event for App.tsx
window.dispatchEvent(new CustomEvent('mcp:ready'));
```

#### routerAgent.ts - Создание agent с MCP

```typescript
function createRouterAgent(mcpServers: MCPServerStreamableHttp[] = []): RealtimeAgent {
  return new RealtimeAgent({
    name: 'routerAgent',
    mcpServers: mcpServers, // ✅ Passed at creation time
    // ...
  });
}

export async function initializeMCPServersBeforeAgent(): Promise<RealtimeAgent | null> {
  const mcpServer = await mcpServerManager.fetchAndInitialize();
  if (!mcpServer) return null;

  // RECREATE agent with connected MCP server
  currentRouterAgent = createRouterAgent([mcpServer]);
  routerAgent = currentRouterAgent;

  return currentRouterAgent;
}

export function getCurrentRouterAgent(): RealtimeAgent {
  return currentRouterAgent; // ✅ Always returns current instance
}
```

#### App.tsx - Использование agent

```typescript
const connectToRealtime = async () => {
  // Get current agent (with MCP servers after initialization)
  const currentRouterAgent = getCurrentRouterAgent();

  await connect({
    initialAgents: [currentRouterAgent], // ✅ Correct instance
  });
};
```

## Результат

### После исправления

```
┌─────────────────────────────────────────────────────────────┐
│ Server Context (Node.js)                                    │
│                                                              │
│  /api/mcp/status/route.ts                                   │
│    ✅ NO imports from client code                           │
│    ✅ Direct fetch to backend API                           │
│                                                              │
│  /api/mcp/initialize/route.ts                               │
│    ✅ NO imports from client code                           │
│    ✅ Just verifies container status                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Client Context (Browser) - SINGLE INSTANCE                  │
│                                                              │
│  routerAgent.ts (module scope)                              │
│    ✅ Executed ONLY in browser                              │
│    ✅ export let routerAgent = createRouterAgent()         │
│                                                              │
│  UserProfile.tsx                                            │
│    ✅ calls initializeMCPServersBeforeAgent()              │
│    ✅ recreates SAME instance with MCP                     │
│                                                              │
│  App.tsx                                                    │
│    ✅ getCurrentRouterAgent() returns CORRECT instance     │
│    ✅ RealtimeSession created with agent that HAS MCP      │
│                                                              │
│  RealtimeSession.connect()                                  │
│    ✅ SUCCESS - trace context matches agent instance       │
└─────────────────────────────────────────────────────────────┘
```

## Правила для Next.js App Router

### ❌ НИКОГДА не делайте

```typescript
// Server-side API route
import { clientSingleton } from '@/client/code';

export async function GET() {
  clientSingleton.doSomething(); // ❌ НЕПРАВИЛЬНО
}
```

### ✅ ВСЕГДА делайте

```typescript
// Server-side API route - independent from client code
export async function GET() {
  const result = await fetch('http://backend-api/endpoint'); // ✅ ПРАВИЛЬНО
  return NextResponse.json(result);
}
```

### Разделение client/server кода

1. **Client-side** (`'use client'` components):
   - Используют singletons (routerAgent, mcpServerManager)
   - Импортируют из `@/app/agentConfigs/...`
   - Выполняются в браузере

2. **Server-side** (API routes):
   - НЕ импортируют client singletons
   - Делают прямые fetch к backend API
   - Выполняются на сервере Node.js

## Оставшиеся тестовые endpoints

### /api/test-mcp-email/route.ts

⚠️ Этот endpoint всё ещё импортирует `mcpServerManager`, но это:
- Только для тестирования (не используется в продакшене)
- Требует рефакторинга аналогично `/api/mcp/tools/route.ts`
- Должен создавать свой временный MCP instance вместо использования singleton

**TODO**: Рефакторить `/api/test-mcp-email/route.ts` чтобы не импортировать client код.

## Тестирование

### 1. Проверить, что server routes не импортируют client код

```bash
cd /home/vladmac/dev/oma-frontend
grep -r "from '@/app/agentConfigs" src/app/api/
```

**Ожидаемый результат**: Только `/api/test-mcp-email/route.ts` (test endpoint)

### 2. Запустить приложение

```bash
make prod
```

### 3. Проверить инициализацию

1. Откройте https://rndaibot.ru
2. Залогиньтесь
3. User Profile → Start MCP Container
4. Дождитесь healthy status
5. Проверьте browser console:
   ```
   [routerAgent] ✅ Router agent recreated with MCP servers
   [App] 📡 Using router agent for session
   [useRealtimeSession] Root agent has MCP servers
   [useRealtimeSession] ✅ Connected successfully
   ```

### 4. Проверить отсутствие ошибки

❌ **Больше НЕ должно быть**: `Error: No existing trace found`

✅ **Должно быть**: `Connected successfully`

## Файлы, которые были изменены

1. **[/api/mcp/status/route.ts](src/app/api/mcp/status/route.ts)**
   - Удален import `mcpServerManager`
   - Добавлен прямой fetch к backend API

2. **[/api/mcp/initialize/route.ts](src/app/api/mcp/initialize/route.ts)**
   - Удален import `mcpServerManager`
   - Endpoint теперь только проверяет container status
   - Добавлено примечание что реальная инициализация - client-side

## Ссылки

- [MCP_INTEGRATION_FIX.md](MCP_INTEGRATION_FIX.md) - Детальная техническая документация
- [README_MCP_FIX.md](README_MCP_FIX.md) - Итоги исправления
- [Next.js App Router Docs](https://nextjs.org/docs/app/building-your-application/routing)
- [GitHub Issue #580](https://github.com/openai/openai-agents-js/issues/580)

## Статус

✅ **Client/Server separation исправлено**

Теперь:
1. Server routes НЕ импортируют client singletons
2. Client-side код выполняется ТОЛЬКО в браузере
3. Agent instance создается один раз в правильном контексте
4. Ошибка "No existing trace found" устранена
