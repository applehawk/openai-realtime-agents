# Анализ конфликтов API роутинга

## Архитектура роутинга

### 1. Next.js API Routes (`/api/*`)
**Порт:** 3000 (localhost)  
**Доступ:** Через nginx → `http://localhost:3000/api/*`

**Существующие роуты:**
- `/api/auth/*` - login, logout, register, me
- `/api/containers/*` - start, status, stop  
- `/api/google/*` - auth-url, disconnect, status
- `/api/mcp/*` - initialize, status
- `/api/rag/*` - proxy для RAG MCP
- `/api/rag-rest/*` - proxy для RAG REST API
- `/api/rag-health/*` - health check
- `/api/interview/*`
- `/api/supervisor/*`
- `/api/session/*`
- `/api/health/*`
- `/api/health-env/*`
- `/api/test-mcp/*`
- `/api/test-mcp-tools/*`
- `/api/test-mcp-email/*`
- `/api/validate-answer/*`
- `/api/responses/*`

### 2. Backend API (`http://multiagent_app:7000/api/v1/*`)
**Порт:** 7000 (Docker container: `multiagent_app`)  
**Доступ:** Только внутри Docker сети через server-side fetch

**Используется в:**
- `src/app/api/containers/status/route.ts` → `http://multiagent_app:7000/api/v1/containers/status`
- `src/app/api/containers/start/route.ts` → `http://multiagent_app:7000/api/v1/containers/start`
- `src/app/api/containers/stop/route.ts` → `http://multiagent_app:7000/api/v1/containers/stop`
- `src/app/api/google/status/route.ts` → `http://multiagent_app:7000/api/v1/google/status`
- `src/app/api/google/auth-url/route.ts` → `http://multiagent_app:7000/api/v1/google/auth-url`
- `src/app/api/google/disconnect/route.ts` → `http://multiagent_app:7000/api/v1/google/disconnect`
- `src/app/api/mcp/initialize/route.ts` → `http://multiagent_app:7000/api/v1/containers/status`

### 3. Nginx Proxy Configuration

**Внешние пути:**
- `/apib/*` → `http://localhost:7000/api/*` (проксирование на backend)
- `/rag-api/*` → `http://79.132.139.57:9621/*` (RAG API)
- `/health` → `http://localhost:7000/health` (backend health check)
- `/docs`, `/redoc`, `/openapi.json` → `http://localhost:7000/*` (Swagger UI)
- `/api/*` → попадает в `location /` → `http://localhost:3000` (Next.js)

## Анализ конфликтов

### ✅ Конфликтов НЕТ

**Причины:**

1. **Разные пути:**
   - Next.js: `/api/containers/status`
   - Backend: `/api/v1/containers/status`
   - Пути не совпадают, т.к. backend использует префикс `/api/v1/`

2. **Разные уровни доступа:**
   - Next.js API роуты доступны клиентам через nginx
   - Backend API (`multiagent_app:7000`) доступен только внутри Docker сети через server-side fetch
   - Клиенты не могут напрямую обратиться к `multiagent_app:7000`

3. **Nginx разделение:**
   - Клиентские запросы к backend идут через `/apib/*` (не `/api/*`)
   - Запросы `/api/*` обрабатываются Next.js

4. **Разные порты:**
   - Next.js: порт 3000
   - Backend: порт 7000 (внутренний Docker network)

### Схема запросов

```
Клиент → Nginx → Next.js (порт 3000)
         ↓
    /api/containers/status (Next.js route)
         ↓
    fetch('http://multiagent_app:7000/api/v1/containers/status')
         ↓
    Backend (порт 7000)
```

```
Клиент → Nginx → Backend (порт 7000)
         ↓
    /apib/v1/containers/status
         ↓
    http://localhost:7000/api/v1/containers/status
```

## Вывод

**Конфликтов между роутерами нет:**
- Next.js `/api/*` роуты не пересекаются с backend `/api/v1/*` путями
- Nginx корректно разделяет трафик
- Backend доступен только через внутренний Docker network

