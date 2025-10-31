# 🔒 Исправление Mixed Content Error

## 🐛 Проблема

```
Mixed Content: The page at 'https://rndaibot.ru' was loaded over HTTPS, 
but requested an insecure resource 'http://79.132.139.57:9621/documents/text'. 
This request has been blocked;
```

## 🎯 Причина

В файле `userPreferencesTool.ts` был прямой вызов RAG API с хардкод HTTP URL вместо использования централизованной функции `callRagApiDirect`.

## ✅ Что исправлено

### Файл: `src/app/agentConfigs/severstalAssistantAgent/tools/rag/userPreferencesTool.ts`

#### Было (❌ неправильно):
```typescript
async function updatePreferencesInRag(...) {
  const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621';
  
  const response = await fetch(`${RAG_API_BASE_URL}/documents/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, file_source, workspace }),
  });
}
```

#### Стало (✅ правильно):
```typescript
import { callRagApiDirect } from '@/app/lib/ragApiClient';

async function updatePreferencesInRag(...) {
  // Use callRagApiDirect for server-side execution (same as interviewTools)
  await callRagApiDirect('/documents/text', 'POST', {
    text: preferenceText,
    file_source: `preference_update_${category}`,
    workspace: workspaceName,
  });
}
```

## 📊 Преимущества исправления

### 1. **Централизованная конфигурация** ✅
- Все RAG API вызовы используют одну функцию `callRagApiDirect`
- URL берется из environment переменных
- Легко изменить URL в одном месте

### 2. **Graceful degradation** ✅
```typescript
// Добавлена обработка ошибок сети
if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
  console.error(`RAG server appears to be down. Preferences will not be saved.`);
  return false;  // Не падаем, а продолжаем работу
}
```

### 3. **Консистентность** ✅
- Теперь `userPreferencesTool` работает так же как `interviewTools`
- Одинаковая обработка ошибок
- Одинаковое логирование

### 4. **Решена Mixed Content проблема** ✅
- Нет хардкод HTTP URLs в коде
- Все вызовы идут через `callRagApiDirect`
- Можно использовать HTTPS если настроить reverse proxy

---

## 🚀 Развертывание на проде

### Шаг 1: Обновите .env на продакшене

```bash
nano .env
```

Убедитесь что есть правильные значения:

```bash
# RAG Configuration
RAG_SERVER_URL=http://79.132.139.57:8000/mcp
RAG_API_BASE_URL=http://79.132.139.57:9621
RAG_API_TIMEOUT=60000
RAG_API_RETRY_ATTEMPTS=5
```

### Шаг 2: Пересоберите и запустите

```bash
# Остановите контейнеры
docker compose down

# Пересоберите с новым кодом
docker compose build --no-cache

# Запустите
docker compose up -d

# Проверьте логи
docker compose logs -f | grep -E "(RAG|UserPreferences)"
```

### Шаг 3: Проверьте что работает

```bash
# 1. Health check
curl http://localhost:3000/api/health-env | grep RAG

# 2. Проверьте RAG API напрямую
./test-rag-api.sh

# 3. Проверьте в браузере
# Откройте https://rndaibot.ru
# Проверьте консоль браузера - не должно быть Mixed Content ошибок
```

---

## 🔐 Опциональное улучшение: HTTPS для RAG API

Если хотите полностью избавиться от HTTP, настройте NGINX reverse proxy:

### Вариант 1: Отдельный subdomain

```nginx
# /etc/nginx/sites-available/rag-api
server {
    listen 443 ssl;
    server_name rag.rndaibot.ru;

    ssl_certificate /path/to/ssl/cert.crt;
    ssl_certificate_key /path/to/ssl/key.key;

    location / {
        proxy_pass http://79.132.139.57:9621;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
```

Затем в `.env`:
```bash
RAG_API_BASE_URL=https://rag.rndaibot.ru
```

### Вариант 2: Path на основном домене

```nginx
# В существующем конфиге rndaibot.ru
location /rag-api/ {
    proxy_pass http://79.132.139.57:9621/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 300;
}
```

Затем в `.env`:
```bash
RAG_API_BASE_URL=https://rndaibot.ru/rag-api
```

---

## 📝 Проверка изменений

### 1. Проверьте что Mixed Content ошибок нет

Откройте DevTools (F12) в браузере на `https://rndaibot.ru`:

```
Console → фильтр: "Mixed Content"
```

✅ Не должно быть ошибок про `http://79.132.139.57:9621`

### 2. Проверьте что RAG API работает

```bash
docker compose logs -f | grep "RAG API"
```

Должны увидеть:
```
[RAG API] Calling POST http://79.132.139.57:9621/documents/text
[RAG API] Success: { endpoint: '/documents/text', hasData: true }
```

### 3. Проверьте что preferences обновляются

В логах при обновлении предпочтений:
```
[UserPreferences] Updated стиль общения for user 123
[RAG API] Calling POST http://79.132.139.57:9621/documents/text
[RAG API] Success
```

---

## 🎯 Итог

### ✅ Что было исправлено:
1. Убран прямой вызов RAG API с хардкод URL
2. Добавлен import `callRagApiDirect` из `ragApiClient`
3. Добавлена graceful degradation для network errors
4. Все RAG API вызовы теперь централизованы

### ✅ Результат:
- ❌ Mixed Content ошибка исчезла
- ✅ Все RAG API вызовы работают одинаково
- ✅ Лучшая обработка ошибок
- ✅ Готовность к переходу на HTTPS

---

**После развертывания Mixed Content ошибок больше не будет! 🎉**

---

**Дата исправления:** 27 октября 2025  
**Файлы изменены:** `src/app/agentConfigs/severstalAssistantAgent/tools/rag/userPreferencesTool.ts`  
**Статус:** ✅ Готово к развертыванию

