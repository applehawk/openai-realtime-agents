# Настройка MCP сервера предпочтений

## Обзор изменений

Система работы с предпочтениями пользователей была переведена с RAG-based подхода на новый MCP сервер предпочтений. Это обеспечивает:

- ✅ Структурированное хранение предпочтений
- ✅ Быстрые запросы без RAG поиска
- ✅ Надежное обновление полей
- ✅ Валидация данных на уровне API
- ✅ Лучшая производительность

## Измененные файлы

### Новые файлы:
- `src/app/lib/preferencesMcpClient.ts` - клиент для MCP сервера
- `src/app/api/preferences-mcp/route.ts` - API прокси для клиентской части
- `MCP_PREFERENCES_SETUP.md` - этот файл

### Обновленные файлы:
- `src/app/agentConfigs/severstalAssistantAgent/tools/interview/interviewTools.ts`
- `src/app/agentConfigs/severstalAssistantAgent/tools/rag/userPreferencesTool.ts`

## Настройка MCP сервера

### 1. Установка зависимостей

```bash
# В директории MCP сервера предпочтений
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# MCP Preferences Server
PREFERENCES_MCP_BASE_URL=http://localhost:3001
PREFERENCES_MCP_TIMEOUT=30000

# Database (для MCP сервера)
DATABASE_URL=postgresql://user:password@localhost:5432/preferences_db
```

### 3. Запуск MCP сервера

```bash
# Запуск MCP сервера предпочтений
npm run dev
# или
node server.js
```

Сервер должен быть доступен по адресу: `http://localhost:3001`

### 4. Проверка работы

```bash
# Проверка API
curl http://localhost:3001/api/v1/mcp/health

# Проверка через Next.js прокси
curl http://localhost:3000/api/preferences-mcp
```

## API Endpoints

### MCP Tools (через прокси `/api/preferences-mcp`):

1. **get_user_preferences** - получить предпочтения пользователя
2. **create_user_preferences** - создать предпочтения
3. **update_user_preferences** - обновить предпочтения
4. **update_preference_field** - обновить конкретное поле
5. **delete_user_preferences** - удалить предпочтения
6. **search_preferences** - поиск по полям
7. **get_all_preferences** - получить все предпочтения

### Прямые REST API:

- `GET /api/v1/mcp/preferences/{user_id}` - получить предпочтения
- `POST /api/v1/mcp/preferences/{user_id}` - создать предпочтения
- `PUT /api/v1/mcp/preferences/{user_id}` - обновить предпочтения
- `PATCH /api/v1/mcp/preferences/{user_id}/{field}?value={value}` - обновить поле
- `DELETE /api/v1/mcp/preferences/{user_id}` - удалить предпочтения

## Структура данных

### Поля предпочтений (русские → английские):

```typescript
const FIELD_MAPPING = {
  'компетенции': 'competencies',
  'стиль общения': 'communication_style', 
  'предпочтения для встреч': 'meeting_preferences',
  'фокусная работа': 'focused_work',
  'стиль работы': 'work_style',
  'карьерные цели': 'career_goals',
  'подход к решению': 'problem_solving_approach',
}
```

### Структура UserPreferences:

```typescript
interface UserPreferences {
  id?: string;
  user_id: string;
  competencies?: string;
  communication_style?: string;
  meeting_preferences?: string;
  focused_work?: string;
  work_style?: string;
  career_goals?: string;
  problem_solving_approach?: string;
  created_at?: string;
  updated_at?: string;
}
```

## Миграция данных

Если у вас есть существующие данные в RAG, создайте скрипт миграции:

```typescript
// Пример миграции из RAG в MCP
import { getUserPreferences, createUserPreferences } from './lib/preferencesMcpClient';

async function migrateUserPreferences(userId: string) {
  // 1. Получить данные из RAG (если нужно)
  // 2. Преобразовать в формат MCP
  // 3. Сохранить через createUserPreferences
}
```

## Тестирование

### 1. Тест создания предпочтений:

```bash
curl -X POST http://localhost:3000/api/preferences-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "create_user_preferences",
    "parameters": {
      "user_id": "test-user-123",
      "competencies": "Python, JavaScript, React",
      "communication_style": "Дружелюбный и поддерживающий"
    },
    "user_id": "test-user-123"
  }'
```

### 2. Тест получения предпочтений:

```bash
curl -X POST http://localhost:3000/api/preferences-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_user_preferences",
    "parameters": {},
    "user_id": "test-user-123"
  }'
```

### 3. Тест обновления поля:

```bash
curl -X POST http://localhost:3000/api/preferences-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "update_preference_field",
    "parameters": {
      "field": "career_goals",
      "value": "Senior Developer, Tech Lead"
    },
    "user_id": "test-user-123"
  }'
```

## Отладка

### Логи клиента:

```typescript
// Включить детальные логи
console.log('[PreferencesMCP] Calling get_user_preferences for user test-user-123');
console.log('[PreferencesMCP] Response: { success: true, hasData: true }');
```

### Логи сервера:

```bash
# Логи MCP сервера
tail -f logs/mcp-server.log

# Логи Next.js
npm run dev
```

## Обработка ошибок

### Типичные ошибки:

1. **Connection refused** - MCP сервер не запущен
2. **Timeout** - сервер не отвечает в течение 30 секунд
3. **Field not found** - неверное название поля
4. **User not found** - пользователь не существует

### Graceful degradation:

Если MCP сервер недоступен, система:
- Продолжает работу без сохранения предпочтений
- Возвращает соответствующие сообщения пользователю
- Логирует ошибки для отладки

## Мониторинг

### Health check:

```bash
# Проверка состояния MCP сервера
curl http://localhost:3001/health

# Проверка через прокси
curl http://localhost:3000/api/preferences-mcp
```

### Метрики:

- Количество запросов к MCP серверу
- Время ответа
- Количество ошибок
- Количество созданных/обновленных предпочтений

## Безопасность

### Аутентификация:

- MCP сервер должен проверять `user_id`
- API прокси не добавляет дополнительной аутентификации
- Все запросы логируются

### Валидация:

- Поля предпочтений валидируются на уровне MCP сервера
- Максимальная длина значений
- Санитизация входных данных

## Производительность

### Кэширование:

- MCP сервер может кэшировать часто запрашиваемые предпочтения
- Next.js кэширует API ответы

### Оптимизация:

- Параллельные запросы для проверки множественных полей
- Батчинг обновлений
- Индексы в базе данных

## Заключение

Переход на MCP сервер предпочтений обеспечивает:

- ✅ Более надежное хранение данных
- ✅ Лучшую производительность
- ✅ Структурированный API
- ✅ Простоту отладки и мониторинга
- ✅ Возможность масштабирования

Валидация ответов пользователя остается без изменений и продолжает работать через `validateInterviewAnswer`.
