# RAG Server Health Check

Система автоматической проверки доступности RAG сервера при старте приложения.

## Возможности

- ✅ **Автоматическая проверка при старте** - проверяет доступность RAG API и MCP серверов
- ✅ **API endpoint** - `/api/rag-health` для ручной проверки статуса
- ✅ **UI компонент** - отображение статуса в правом нижнем углу
- ✅ **Настраиваемые параметры** - через переменные окружения
- ✅ **Отключение проверок** - можно полностью отключить через env переменные
- ✅ **Graceful degradation** - приложение продолжает работать даже при недоступности RAG

## Переменные окружения

### Основные настройки

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `RAG_HEALTH_CHECK_ENABLED` | `true` | Включить/отключить проверку здоровья |
| `RAG_HEALTH_CHECK_TIMEOUT` | `10000` | Таймаут запроса в миллисекундах |
| `RAG_HEALTH_CHECK_RETRIES` | `3` | Количество попыток при неудаче |
| `RAG_HEALTH_CHECK_RETRY_DELAY` | `1000` | Задержка между попытками в мс |

### UI настройки

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `NEXT_PUBLIC_RAG_HEALTH_CHECK_ENABLED` | `true` | Показывать/скрывать UI компонент |

## Использование

### 1. Автоматическая проверка при старте

Проверка выполняется автоматически при загрузке приложения:

```bash
# Включить проверку (по умолчанию)
RAG_HEALTH_CHECK_ENABLED=true

# Отключить проверку
RAG_HEALTH_CHECK_ENABLED=false
```

### 2. API endpoint

```bash
# Проверить статус RAG серверов
curl http://localhost:3000/api/rag-health

# Принудительная проверка с настройками
curl -X POST http://localhost:3000/api/rag-health \
  -H "Content-Type: application/json" \
  -d '{"timeout": 5000, "retries": 2}'
```

**Ответ API:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "servers": {
    "api": {
      "url": "http://79.132.139.57:9621",
      "accessible": true,
      "responseTime": 150
    },
    "mcp": {
      "url": "http://79.132.139.57:8000/mcp",
      "accessible": true,
      "responseTime": 200
    }
  },
  "summary": {
    "api": "accessible",
    "mcp": "accessible",
    "overall": "healthy"
  }
}
```

### 3. UI компонент

Компонент автоматически отображается в правом нижнем углу:

- ✅ **Зеленый** - все серверы доступны
- ⚠️ **Желтый** - некоторые серверы недоступны
- ❌ **Красный** - ошибка проверки

### 4. Программное использование

```typescript
import { ragHealthChecker } from '@/app/lib/ragHealthChecker';
import { performStartupHealthCheck } from '@/app/lib/startupHealthCheck';

// Выполнить проверку
const status = await ragHealthChecker.checkHealth();

// Проверить при старте
await performStartupHealthCheck();
```

## Конфигурация для разных окружений

### Development
```bash
# .env.local
RAG_HEALTH_CHECK_ENABLED=true
RAG_HEALTH_CHECK_TIMEOUT=5000
RAG_HEALTH_CHECK_RETRIES=2
NEXT_PUBLIC_RAG_HEALTH_CHECK_ENABLED=true
```

### Production
```bash
# .env.production
RAG_HEALTH_CHECK_ENABLED=true
RAG_HEALTH_CHECK_TIMEOUT=10000
RAG_HEALTH_CHECK_RETRIES=3
NEXT_PUBLIC_RAG_HEALTH_CHECK_ENABLED=false  # Скрыть UI в продакшене
```

### Testing
```bash
# .env.test
RAG_HEALTH_CHECK_ENABLED=false  # Отключить для тестов
```

## Логирование

Система выводит подробные логи:

```
🚀 Initializing application...
🏥 Starting RAG server health check...
🔧 RAG Health Check Configuration:
   Enabled: true
   Timeout: 10000ms
   Retries: 3
   Retry Delay: 1000ms
   API URL: http://79.132.139.57:9621
   MCP URL: http://79.132.139.57:8000/mcp

🔍 Checking RAG API (attempt 1/3)
✅ RAG API (http://79.132.139.57:9621) is accessible (150ms)
🔍 Checking RAG MCP (attempt 1/3)
✅ RAG MCP (http://79.132.139.57:8000/mcp) is accessible (200ms)
✅ RAG Health Check Complete (350ms): All RAG servers are accessible
✅ RAG servers are ready for use
✅ Application initialization completed
```

## Troubleshooting

### RAG сервер недоступен

```
⚠️  RAG servers have issues, but application will continue
💡 You can disable this check by setting RAG_HEALTH_CHECK_ENABLED=false
```

### Отключение проверки

```bash
# Полностью отключить проверку
export RAG_HEALTH_CHECK_ENABLED=false

# Скрыть UI компонент
export NEXT_PUBLIC_RAG_HEALTH_CHECK_ENABLED=false
```

### Настройка таймаутов

```bash
# Увеличить таймаут для медленных сетей
export RAG_HEALTH_CHECK_TIMEOUT=30000

# Уменьшить количество попыток
export RAG_HEALTH_CHECK_RETRIES=1
```

## Архитектура

```
Application Startup
       ↓
initializeApplication()
       ↓
performStartupHealthCheck()
       ↓
ragHealthChecker.checkHealth()
       ↓
┌─────────────────┬─────────────────┐
│   RAG API       │   RAG MCP       │
│   (port 9621)   │   (port 8000)   │
└─────────────────┴─────────────────┘
       ↓
   Status Report
       ↓
┌─────────────────┬─────────────────┐
│   API Endpoint  │   UI Component  │
│   /api/rag-health│   Status Display│
└─────────────────┴─────────────────┘
```

## Файлы системы

- `src/app/lib/ragHealthChecker.ts` - основная логика проверки
- `src/app/lib/startupHealthCheck.ts` - инициализация при старте
- `src/app/lib/appInitializer.ts` - общий инициализатор приложения
- `src/app/api/rag-health/route.ts` - API endpoint
- `src/app/components/RagServerStatus.tsx` - UI компонент
- `src/app/layout.tsx` - интеграция в layout
