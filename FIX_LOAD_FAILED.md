# Исправление ошибок "Load failed"

## Проблема
После изменений в Dockerfile и docker-compose.yml возникают ошибки:
- `[Error] Failed to load container status: TypeError: Load failed`
- `[Error] Failed to check interview status: TypeError: Load failed`
- `[Error] Check Google status error: TypeError: Load failed`

## Причина
Контейнер был собран со старыми build arguments, которые больше не используются. Нужна полная пересборка.

## Решение

### Вариант 1: Полная пересборка (рекомендуется)

```bash
# Остановить контейнеры
docker compose down

# Пересобрать без кэша
docker compose build --no-cache

# Запустить
docker compose up -d

# Проверить логи
docker compose logs -f realtime-agents
```

### Вариант 2: Одной командой

```bash
docker compose up --build --no-cache --force-recreate -d
```

### Вариант 3: Через Makefile (после пересборки)

```bash
make updown
```

## Что было исправлено

1. ✅ Улучшена обработка ошибок в `UserProfile.tsx`
2. ✅ Улучшена обработка ошибок в `InterviewButton.tsx`
3. ✅ Убраны ненужные build arguments из Dockerfile
4. ✅ Оптимизирован docker-compose.yml

## Проверка после пересборки

```bash
# Проверить статус
docker compose ps

# Проверить переменные окружения
docker compose exec realtime-agents env | grep -E "(AUTH_API|RAG_)"

# Проверить логи
docker compose logs realtime-agents | tail -20
```

## Если ошибки остаются

1. Проверьте доступность backend:
   ```bash
   docker compose exec realtime-agents wget -qO- http://multiagent_app:7000/health
   ```

2. Проверьте API endpoints:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. Проверьте логи на ошибки:
   ```bash
   docker compose logs realtime-agents | grep -i error
   ```


