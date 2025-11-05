# Interview RAG API Proxy Fix

## Problem

The interview tools were failing with "Failed to fetch" errors when trying to create workspaces or save interview data:

```
Error: RAG API connection failed: Failed to fetch
```

## Root Cause

The interview tools (`interviewTools.ts`) were using `callRagApiDirect()` which attempts to make direct HTTP calls from the **client-side** (browser) to the RAG API server. This failed because:

1. **Environment variables are not available in the browser** - `RAG_API_BASE_URL` is a server-side env var
2. **CORS issues** - The browser can't make direct requests to the RAG API server
3. **Mixed content** - Browser trying to call HTTP from HTTPS contexts

## Architecture Issue

The realtime tools run in the browser (client-side) via OpenAI Realtime API, but were trying to:
```typescript
// ❌ This doesn't work from browser:
import { callRagApiDirect } from '@/app/lib/ragApiClient';
await callRagApiDirect('/workspaces', 'GET');
```

Other RAG tools (like `ragTools.ts`) correctly use the `/api/rag` proxy for MCP calls, but interview tools needed REST API access which wasn't proxied.

## Solution

Created a new Next.js API proxy endpoint for REST API calls:

### 1. Created `/api/rag-rest/route.ts`

A server-side proxy that:
- Runs on the Next.js server (has access to environment variables)
- Forwards REST API requests to the RAG server
- Handles errors and timeouts properly
- Provides health check endpoint (GET)

### 2. Updated `interviewTools.ts`

Replaced direct API calls with proxy calls:

```typescript
// ✅ New approach - uses server-side proxy:
const RAG_REST_PROXY = '/api/rag-rest';

async function callRagApi(endpoint: string, method: string, data?: any) {
  const response = await fetch(RAG_REST_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, data }),
  });
  // ... handle response
}
```

## Request Flow

### Before (❌ Failed):
```
Browser (Realtime Tool)
  → Direct HTTP to http://79.132.139.57:9621
  ❌ CORS error / No env vars / Failed to fetch
```

### After (✅ Works):
```
Browser (Realtime Tool)
  → POST /api/rag-rest (same domain, no CORS)
    → Next.js API Route (server-side, has env vars)
      → RAG API at RAG_API_BASE_URL
        → Production: https://rag.rndaibot.ru (nginx proxy)
        → Development: http://79.132.139.57:9621
```

## Production Configuration

The solution works seamlessly with your production nginx setup:

```nginx
# nginx config for rag.rndaibot.ru
server {
    listen 443 ssl;
    server_name rag.rndaibot.ru;
    
    location / {
        proxy_pass http://79.132.139.57:9621;
        # ... proxy settings
    }
}
```

Environment variables:
```bash
# Production
RAG_API_BASE_URL=https://rag.rndaibot.ru

# Development  
RAG_API_BASE_URL=http://79.132.139.57:9621
```

## Files Modified

1. **Created**: `src/app/api/rag-rest/route.ts`
   - New proxy endpoint for REST API calls
   - Supports GET (health check) and POST (proxy requests)

2. **Updated**: `src/app/agentConfigs/severstalAssistantAgent/tools/interview/interviewTools.ts`
   - Removed `import { callRagApiDirect }` 
   - Added local `callRagApi()` function that uses proxy
   - Updated all API calls to use proxy

## Testing

### Health Check
```bash
curl http://localhost:3000/api/rag-rest
# Should return:
# {
#   "status": "ok",
#   "ragApiUrl": "https://rag.rndaibot.ru",
#   "workspacesCount": 5
# }
```

### Interview Flow
1. User starts interview
2. Tool calls `createUserWorkspace(userId)`
3. Browser calls `/api/rag-rest` proxy
4. Proxy calls RAG API with proper env vars
5. ✅ Workspace created successfully

## Benefits

- ✅ Works in production with HTTPS
- ✅ No CORS issues
- ✅ Environment variables work correctly
- ✅ Consistent with other RAG tools architecture
- ✅ Proper error handling and logging
- ✅ Server-side timeout management

## Related Files

- `/api/rag/route.ts` - Similar proxy for MCP JSON-RPC calls
- `ragTools.ts` - Uses `/api/rag` proxy (reference implementation)
- `ragApiClient.ts` - Server-side direct API client (for server components)
- `userPreferencesTool.ts` - Also uses `/api/rag` proxy pattern

