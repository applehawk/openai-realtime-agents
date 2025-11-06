# Правильная пересборка Docker контейнера

## После изменений в Dockerfile или docker-compose.yml

### Вариант 1: Быстрая пересборка (использует кэш где возможно)

```bash
# Остановить и удалить контейнеры
docker compose down

# Пересобрать и запустить
docker compose up --build --force-recreate -d

# Или через make
make updown
```

### Вариант 2: Полная пересборка без кэша (рекомендуется после изменений в Dockerfile)

```bash
# Остановить и удалить контейнеры
docker compose down

# Пересобрать без кэша (чистая сборка)
docker compose build --no-cache

# Запустить
docker compose up -d

# Или одной командой
docker compose up --build --no-cache --force-recreate -d
```

### Вариант 3: Полная очистка и пересборка (если что-то пошло не так)

```bash
# Остановить и удалить контейнеры
docker compose down

# Удалить старые образы (опционально, освобождает место)
docker compose down --rmi all

# Удалить volumes (если нужно)
docker compose down -v

# Пересобрать без кэша
docker compose build --no-cache

# Запустить
docker compose up -d
```

### Вариант 4: Пересборка конкретного сервиса

```bash
# Пересобрать только realtime-agents сервис
docker compose build --no-cache realtime-agents

# Запустить/перезапустить
docker compose up -d realtime-agents
```

## После текущих изменений (Dockerfile + docker-compose.yml)

Рекомендуется использовать **Вариант 2** (полная пересборка):

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Или одной командой:
```bash
docker compose up --build --no-cache --force-recreate -d
```

## Проверка результата

```bash
# Проверить статус контейнеров
docker compose ps

# Посмотреть логи
docker compose logs -f realtime-agents

# Проверить, что образ собрался с новыми build args
docker compose images
```

## Полезные команды для отладки

```bash
# Зайти внутрь контейнера
docker compose exec realtime-agents sh

# Проверить переменные окружения в контейнере
docker compose exec realtime-agents env | grep -E "(AUTH_API|RAG_)"

# Проверить, что NEXT_PUBLIC_AUTH_API_URL встроен в build
docker compose exec realtime-agents cat /app/.next/static/chunks/*.js | grep -o "rndaibot.ru" | head -1
```


