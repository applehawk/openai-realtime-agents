# MCP Tools - Описание инструментов

## Обзор

MCP сервер предоставляет 7 инструментов для управления предпочтениями пользователей. Каждый инструмент имеет четко определенные параметры и возвращает структурированный ответ.

---

## 1. get_user_preferences

**Описание:** Получить предпочтения пользователя

**Параметры:**
- `user_id` (string, обязательный) - ID пользователя

**Пример запроса:**
```json
{
  "tool_name": "get_user_preferences",
  "parameters": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'get_user_preferences' executed successfully",
  "data": {
    "preferences": {
      "id": "uuid",
      "user_id": "uuid",
      "competencies": "Python, FastAPI, PostgreSQL",
      "communication_style": "Прямой и конструктивный",
      "meeting_preferences": "Утренние встречи",
      "focused_work": "Глубокая работа в тишине",
      "work_style": "Самостоятельная работа",
      "career_goals": "Senior Developer",
      "problem_solving_approach": "Системный анализ",
      "created_at": "2025-10-28T14:10:10.205073",
      "updated_at": "2025-10-28T14:10:10.205073"
    }
  }
}
```

---

## 2. create_user_preferences

**Описание:** Создать предпочтения пользователя

**Параметры:**
- `user_id` (string, обязательный) - ID пользователя
- `competencies` (string, опциональный) - Компетенции
- `communication_style` (string, опциональный) - Стиль общения
- `meeting_preferences` (string, опциональный) - Предпочтения для встреч
- `focused_work` (string, опциональный) - Фокусная работа
- `work_style` (string, опциональный) - Стиль работы
- `career_goals` (string, опциональный) - Карьерные цели
- `problem_solving_approach` (string, опциональный) - Подход к решению проблем

**Пример запроса:**
```json
{
  "tool_name": "create_user_preferences",
  "parameters": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "competencies": "Python, FastAPI, PostgreSQL",
    "communication_style": "Прямой и конструктивный",
    "meeting_preferences": "Утренние встречи, короткие",
    "focused_work": "Глубокая работа в тихой обстановке",
    "work_style": "Самостоятельная работа с синками",
    "career_goals": "Senior Developer, Tech Lead",
    "problem_solving_approach": "Системный анализ"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'create_user_preferences' executed successfully",
  "data": {
    "message": "User preferences created successfully",
    "preferences": {
      "id": "uuid",
      "user_id": "uuid",
      "created_at": "2025-10-28T14:10:10.205073"
    }
  }
}
```

---

## 3. update_user_preferences

**Описание:** Обновить предпочтения пользователя

**Параметры:**
- `user_id` (string, обязательный) - ID пользователя
- Любые поля предпочтений для обновления (опциональные)

**Пример запроса:**
```json
{
  "tool_name": "update_user_preferences",
  "parameters": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "competencies": "Python, FastAPI, PostgreSQL, Docker",
    "career_goals": "Tech Lead, CTO"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'update_user_preferences' executed successfully",
  "data": {
    "message": "User preferences updated successfully",
    "preferences": {
      "id": "uuid",
      "user_id": "uuid",
      "updated_at": "2025-10-28T14:10:10.205073"
    }
  }
}
```

---

## 4. update_preference_field

**Описание:** Обновить конкретное поле предпочтений

**Параметры:**
- `user_id` (string, обязательный) - ID пользователя
- `field` (string, обязательный) - Название поля
- `value` (string, обязательный) - Новое значение

**Доступные поля:**
- `competencies`
- `communication_style`
- `meeting_preferences`
- `focused_work`
- `work_style`
- `career_goals`
- `problem_solving_approach`

**Пример запроса:**
```json
{
  "tool_name": "update_preference_field",
  "parameters": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "field": "career_goals",
    "value": "Tech Lead, CTO, Open Source Contributor"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'update_preference_field' executed successfully",
  "data": {
    "message": "Field 'career_goals' updated successfully",
    "preferences": {
      "id": "uuid",
      "user_id": "uuid",
      "field": "career_goals",
      "value": "Tech Lead, CTO, Open Source Contributor",
      "updated_at": "2025-10-28T14:10:10.205073"
    }
  }
}
```

---

## 5. delete_user_preferences

**Описание:** Удалить предпочтения пользователя

**Параметры:**
- `user_id` (string, обязательный) - ID пользователя

**Пример запроса:**
```json
{
  "tool_name": "delete_user_preferences",
  "parameters": {
    "user_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'delete_user_preferences' executed successfully",
  "data": {
    "message": "User preferences deleted successfully"
  }
}
```

---

## 6. search_preferences

**Описание:** Поиск предпочтений по полю

**Параметры:**
- `field` (string, обязательный) - Поле для поиска
- `search_term` (string, обязательный) - Поисковый запрос

**Доступные поля для поиска:**
- `competencies`
- `communication_style`
- `meeting_preferences`
- `focused_work`
- `work_style`
- `career_goals`
- `problem_solving_approach`

**Пример запроса:**
```json
{
  "tool_name": "search_preferences",
  "parameters": {
    "field": "competencies",
    "search_term": "Python"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'search_preferences' executed successfully",
  "data": {
    "message": "Found 2 preferences matching 'Python' in field 'competencies'",
    "preferences": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "field_value": "Python, FastAPI, PostgreSQL",
        "created_at": "2025-10-28T14:10:10.205073"
      }
    ]
  }
}
```

---

## 7. get_all_preferences

**Описание:** Получить все предпочтения

**Параметры:**
- `skip` (integer, опциональный) - Количество записей для пропуска (по умолчанию: 0)
- `limit` (integer, опциональный) - Максимальное количество записей (по умолчанию: 100)

**Пример запроса:**
```json
{
  "tool_name": "get_all_preferences",
  "parameters": {
    "skip": 0,
    "limit": 10
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'get_all_preferences' executed successfully",
  "data": {
    "message": "Retrieved 5 preferences",
    "preferences": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "competencies": "Python, FastAPI",
        "communication_style": "Прямой",
        "meeting_preferences": "Утренние встречи",
        "focused_work": "Глубокая работа",
        "work_style": "Самостоятельная",
        "career_goals": "Senior Developer",
        "problem_solving_approach": "Системный анализ",
        "created_at": "2025-10-28T14:10:10.205073",
        "updated_at": "2025-10-28T14:10:10.205073"
      }
    ]
  }
}
```

---

## Общие структуры ответов

### Успешный ответ
```json
{
  "success": true,
  "message": "Tool executed successfully",
  "data": {
    // Данные инструмента
  },
  "error": null
}
```

### Ответ с ошибкой
```json
{
  "success": false,
  "message": "Error executing tool",
  "data": null,
  "error": "Описание ошибки"
}
```

---

## Коды ошибок

| Ошибка | Описание |
|--------|----------|
| `User preferences not found` | Предпочтения пользователя не найдены |
| `Preferences already exist for this user` | Предпочтения уже существуют |
| `Field 'field_name' does not exist` | Неверное название поля |
| `Foreign key constraint violation` | Пользователь не существует |

---

## Примеры использования

### Создание полного профиля предпочтений
```json
{
  "tool_name": "create_user_preferences",
  "parameters": {
    "user_id": "user123",
    "competencies": "Python, JavaScript, React, Node.js, PostgreSQL",
    "communication_style": "Дружелюбный и поддерживающий",
    "meeting_preferences": "Утренние встречи, максимум 30 минут",
    "focused_work": "Глубокая работа в тихой обстановке с музыкой",
    "work_style": "Самостоятельная работа с ежедневными синками",
    "career_goals": "Senior Full-Stack Developer, Tech Lead",
    "problem_solving_approach": "Итеративный подход, тестирование решений"
  },
  "user_id": "user123"
}
```

### Обновление карьерных целей
```json
{
  "tool_name": "update_preference_field",
  "parameters": {
    "user_id": "user123",
    "field": "career_goals",
    "value": "Tech Lead, CTO, Open Source Contributor"
  },
  "user_id": "user123"
}
```

### Поиск разработчиков Python
```json
{
  "tool_name": "search_preferences",
  "parameters": {
    "field": "competencies",
    "search_term": "Python"
  },
  "user_id": "system"
}
```

---

## REST API альтернативы

Для удобства также доступны REST эндпоинты:

- `GET /api/v1/mcp/preferences/{user_id}` - получить предпочтения
- `POST /api/v1/mcp/preferences/{user_id}` - создать предпочтения
- `PUT /api/v1/mcp/preferences/{user_id}` - обновить предпочтения
- `PATCH /api/v1/mcp/preferences/{user_id}/{field}?value={value}` - обновить поле
- `DELETE /api/v1/mcp/preferences/{user_id}` - удалить предпочтения
- `GET /api/v1/mcp/preferences/search/{field}/{search_term}` - поиск

---

## SSE для real-time обновлений

Для получения real-time обновлений используйте SSE эндпоинт:

```
GET /api/v1/mcp/stream/{user_id}
```

**Пример JavaScript:**
```javascript
const eventSource = new EventSource('/api/v1/mcp/stream/user123');

eventSource.onmessage = function(event) {
  const preferences = JSON.parse(event.data);
  console.log('Updated preferences:', preferences);
};
```
