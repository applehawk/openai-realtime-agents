# Отладка ошибок "Load failed"

## Проблема
После изменений в Dockerfile возникают ошибки:
- `TypeError: Load failed` при загрузке Google status, container status, interview status
- `Error: No existing trace found` при работе с MCP tools

## Что было сделано

### 1. Улучшена обработка ошибок
- ✅ Добавлена детальная обработка сетевых ошибок
- ✅ Добавлено логирование статусов и ошибок
- ✅ Улучшена обработка не-JSON ответов

### 2. Проверка контейнера

```bash
# Проверить статус
docker compose ps

# Проверить логи
docker compose logs realtime-agents | tail -50

# Проверить переменные окружения
docker compose exec realtime-agents env | grep -E "(AUTH_API|RAG_)"
```

## Возможные причины

### 1. Контейнер не был пересобран
**Решение:**
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 2. Проблемы с авторизацией
Ошибки могут возникать, если:
- Cookie `access_token` не установлен
- Токен истек
- Проблемы с CORS

**Проверка:**
- Откройте DevTools → Application → Cookies
- Убедитесь, что `access_token` присутствует
- Проверьте консоль браузера на CORS ошибки

### 3. Проблемы с сетью/DNS
Видно в логах: `getaddrinfo EAI_AGAIN api.openai.com`

**Решение:**
```bash
# Проверить DNS из контейнера
docker compose exec realtime-agents nslookup api.openai.com

# Проверить доступность backend
docker compose exec realtime-agents wget -qO- http://multiagent_app:7000/health
```

### 4. Проблемы с MCP tools
Ошибка "No existing trace found" может быть связана с:
- MCP сервер не инициализирован
- Проблемы с подключением к OpenAI Realtime API

**Проверка:**
```bash
# Проверить статус MCP
curl http://localhost:3000/api/mcp/status

# Проверить логи MCP
docker compose logs realtime-agents | grep -i mcp
```

## Отладка в браузере

1. Откройте DevTools (F12)
2. Перейдите на вкладку Network
3. Попробуйте загрузить страницу
4. Найдите запросы к `/api/google/status`, `/api/containers/status`, `/api/interview`
5. Проверьте:
   - Статус ответа (200, 401, 500, etc.)
   - Response body
   - Headers (особенно CORS headers)

## Быстрое решение

Если ошибки продолжаются после пересборки:

```bash
# Полная очистка и пересборка
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Проверить логи
docker compose logs -f realtime-agents
```

## Улучшенная обработка ошибок

Теперь в консоли браузера вы увидите более детальные ошибки:
- Network errors (если запрос не смог выполниться)
- HTTP status codes
- Response body ошибок
- Parse errors (если ответ не JSON)

Это поможет быстрее найти причину проблемы.

