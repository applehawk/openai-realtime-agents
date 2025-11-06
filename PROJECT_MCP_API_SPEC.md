# MCP Tools для управления проектами - Спецификация API

## Обзор

MCP сервер предоставляет 7 инструментов для управления проектами. Каждый инструмент имеет четко определенные параметры и возвращает структурированный ответ.

---

## 1. get_project

**Описание:** Получить проект по названию

**Параметры:**
- `name` (string, обязательный) - Название проекта

**Пример запроса:**
```json
{
  "tool_name": "get_project",
  "parameters": {
    "name": "Проект А"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'get_project' executed successfully",
  "data": {
    "project": {
      "id": "uuid",
      "name": "Проект А",
      "manager": "Иван Иванов",
      "team": "Команда разработки",
      "description": "Описание проекта",
      "status": "В разработке",
      "created_at": "2025-01-27T12:00:00.000000",
      "updated_at": "2025-01-27T12:00:00.000000"
    }
  }
}
```

**Ответ, если проект не найден:**
```json
{
  "success": true,
  "message": "Tool 'get_project' executed successfully",
  "data": {
    "message": "Project not found"
  }
}
```

---

## 2. create_project

**Описание:** Создать новый проект

**Параметры:**
- `name` (string, обязательный) - Название проекта
- `manager` (string, опциональный) - Руководитель проекта
- `team` (string, опциональный) - Команда проекта
- `description` (string, опциональный) - Описание проекта
- `status` (string, опциональный) - Статус проекта

**Пример запроса:**
```json
{
  "tool_name": "create_project",
  "parameters": {
    "name": "Новый проект",
    "manager": "Петр Петров",
    "team": "Команда разработки, Команда тестирования",
    "description": "Разработка нового функционала",
    "status": "В планировании"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'create_project' executed successfully",
  "data": {
    "message": "Project created successfully",
    "project": {
      "id": "uuid",
      "name": "Новый проект",
      "created_at": "2025-01-27T12:00:00.000000"
    }
  }
}
```

---

## 3. update_project

**Описание:** Обновить проект (полное или частичное обновление)

**Параметры:**
- `project_id` (string, обязательный) - ID проекта (UUID)
- `name` (string, опциональный) - Название проекта
- `manager` (string, опциональный) - Руководитель проекта
- `team` (string, опциональный) - Команда проекта
- `description` (string, опциональный) - Описание проекта
- `status` (string, опциональный) - Статус проекта

**Пример запроса:**
```json
{
  "tool_name": "update_project",
  "parameters": {
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "В разработке",
    "manager": "Сергей Сидоров"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'update_project' executed successfully",
  "data": {
    "message": "Project updated successfully",
    "project": {
      "id": "uuid",
      "name": "Новый проект",
      "updated_at": "2025-01-27T14:30:00.000000"
    }
  }
}
```

---

## 4. update_project_field

**Описание:** Обновить конкретное поле проекта

**Параметры:**
- `project_id` (string, обязательный) - ID проекта (UUID)
- `field` (string, обязательный) - Название поля для обновления
- `value` (string, обязательный) - Новое значение поля

**Доступные поля:**
- `name` - Название проекта
- `manager` - Руководитель проекта
- `team` - Команда проекта
- `description` - Описание проекта
- `status` - Статус проекта

**Пример запроса:**
```json
{
  "tool_name": "update_project_field",
  "parameters": {
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "field": "status",
    "value": "Завершен"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'update_project_field' executed successfully",
  "data": {
    "message": "Field 'status' updated successfully",
    "project": {
      "id": "uuid",
      "name": "Новый проект",
      "field": "status",
      "value": "Завершен",
      "updated_at": "2025-01-27T15:00:00.000000"
    }
  }
}
```

---

## 5. delete_project

**Описание:** Удалить проект

**Параметры:**
- `project_id` (string, обязательный) - ID проекта (UUID)

**Пример запроса:**
```json
{
  "tool_name": "delete_project",
  "parameters": {
    "project_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа (успешное удаление):**
```json
{
  "success": true,
  "message": "Tool 'delete_project' executed successfully",
  "data": {
    "message": "Project deleted successfully"
  }
}
```

**Пример ответа (проект не найден):**
```json
{
  "success": true,
  "message": "Tool 'delete_project' executed successfully",
  "data": {
    "message": "Project not found"
  }
}
```

---

## 6. search_projects

**Описание:** Поиск проектов по заданному полю

**Параметры:**
- `field` (string, обязательный) - Поле для поиска
- `search_term` (string, обязательный) - Поисковый запрос

**Доступные поля для поиска:**
- `name` - Название проекта
- `manager` - Руководитель проекта
- `team` - Команда проекта
- `description` - Описание проекта
- `status` - Статус проекта

**Пример запроса:**
```json
{
  "tool_name": "search_projects",
  "parameters": {
    "field": "manager",
    "search_term": "Иван"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Tool 'search_projects' executed successfully",
  "data": {
    "message": "Found 2 projects matching 'Иван' in field 'manager'",
    "projects": [
      {
        "id": "uuid",
        "name": "Проект А",
        "field_value": "Иван Иванов",
        "created_at": "2025-01-27T12:00:00.000000"
      },
      {
        "id": "uuid",
        "name": "Проект Б",
        "field_value": "Иван Петров",
        "created_at": "2025-01-27T13:00:00.000000"
      }
    ]
  }
}
```

---

## 7. get_all_projects

**Описание:** Получить список всех проектов с пагинацией

**Параметры:**
- `skip` (integer, опциональный) - Количество записей для пропуска (по умолчанию: 0)
- `limit` (integer, опциональный) - Максимальное количество записей (по умолчанию: 100)

**Пример запроса:**
```json
{
  "tool_name": "get_all_projects",
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
  "message": "Tool 'get_all_projects' executed successfully",
  "data": {
    "message": "Retrieved 5 projects",
    "projects": [
      {
        "id": "uuid",
        "name": "Проект А",
        "manager": "Иван Иванов",
        "team": "Команда разработки",
        "description": "Описание проекта А",
        "status": "В разработке",
        "created_at": "2025-01-27T12:00:00.000000",
        "updated_at": "2025-01-27T12:00:00.000000"
      },
      {
        "id": "uuid",
        "name": "Проект Б",
        "manager": "Петр Петров",
        "team": "Команда тестирования",
        "description": "Описание проекта Б",
        "status": "В планировании",
        "created_at": "2025-01-27T13:00:00.000000",
        "updated_at": "2025-01-27T13:00:00.000000"
      }
    ]
  }
}
```

---

## Общие структуры

### Структура запроса MCP Tool

Все запросы к MCP инструментам имеют следующую структуру:

```json
{
  "tool_name": "название_инструмента",
  "parameters": {
    // Параметры конкретного инструмента
  },
  "user_id": "uuid_пользователя"
}
```

### Структура успешного ответа

```json
{
  "success": true,
  "message": "Tool 'tool_name' executed successfully",
  "data": {
    // Данные, возвращаемые инструментом
  },
  "error": null
}
```

### Структура ответа с ошибкой

```json
{
  "success": false,
  "message": "Error executing tool 'tool_name'",
  "data": null,
  "error": "Описание ошибки"
}
```

### Структура объекта проекта

```json
{
  "id": "uuid",
  "name": "string",
  "manager": "string | null",
  "team": "string | null",
  "description": "string | null",
  "status": "string | null",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime"
}
```

---

## Типы данных

### Поля проекта

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `id` | UUID (string) | Да | Уникальный идентификатор проекта |
| `name` | string | Да | Название проекта |
| `manager` | string \| null | Нет | Руководитель проекта |
| `team` | string \| null | Нет | Команда проекта |
| `description` | string \| null | Нет | Описание проекта |
| `status` | string \| null | Нет | Статус проекта |
| `created_at` | ISO 8601 datetime | Да | Дата и время создания |
| `updated_at` | ISO 8601 datetime | Да | Дата и время последнего обновления |

### Типы параметров

| Параметр | Тип | Описание |
|----------|-----|----------|
| `project_id` | UUID (string) | Идентификатор проекта в формате UUID |
| `name` | string | Текстовая строка |
| `manager` | string | Текстовая строка |
| `team` | string | Текстовая строка |
| `description` | string | Текстовая строка |
| `status` | string | Текстовая строка |
| `field` | string | Название поля проекта |
| `value` | string | Значение поля |
| `search_term` | string | Поисковый запрос |
| `skip` | integer | Количество записей для пропуска |
| `limit` | integer | Максимальное количество записей |

---

## Коды ошибок и исключительные ситуации

| Ситуация | Описание | Возвращаемое сообщение |
|----------|----------|------------------------|
| Проект не найден | При попытке получить/обновить/удалить несуществующий проект | `"Project not found"` |
| Неверное поле | При указании несуществующего поля в `update_project_field` или `search_projects` | `"Field 'field_name' does not exist"` |
| Неверный UUID | При передаче некорректного UUID в `project_id` | Сообщение об ошибке валидации UUID |
| Отсутствие обязательных параметров | При отсутствии обязательных параметров в запросе | Сообщение об ошибке валидации |

---

## Примеры использования

### Создание проекта с полной информацией

```json
{
  "tool_name": "create_project",
  "parameters": {
    "name": "Разработка веб-приложения",
    "manager": "Алексей Смирнов",
    "team": "Frontend: Иван, Петр; Backend: Сергей, Мария; QA: Анна",
    "description": "Разработка современного веб-приложения для управления задачами",
    "status": "В разработке"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Создание минимального проекта

```json
{
  "tool_name": "create_project",
  "parameters": {
    "name": "Новый проект"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Обновление статуса проекта

```json
{
  "tool_name": "update_project_field",
  "parameters": {
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "field": "status",
    "value": "Завершен"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Поиск проектов по статусу

```json
{
  "tool_name": "search_projects",
  "parameters": {
    "field": "status",
    "search_term": "В разработке"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Получение проектов с пагинацией

```json
{
  "tool_name": "get_all_projects",
  "parameters": {
    "skip": 10,
    "limit": 20
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Полное обновление проекта

```json
{
  "tool_name": "update_project",
  "parameters": {
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Обновленное название",
    "manager": "Новый руководитель",
    "team": "Новая команда",
    "description": "Новое описание",
    "status": "Завершен"
  },
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

## Рекомендации по интеграции

### Валидация данных

- Убедитесь, что все обязательные параметры переданы перед вызовом инструмента
- Проверяйте формат UUID для `project_id`
- Валидируйте длину строковых параметров на клиенте перед отправкой

### Обработка ошибок

- Всегда проверяйте поле `success` в ответе
- Если `success: false`, обрабатывайте поле `error` для получения деталей ошибки
- Обрабатывайте случай, когда проект не найден (проверяйте `message` в `data`)

### Пагинация

- Используйте `skip` и `limit` для реализации пагинации на клиенте
- Рекомендуемый размер страницы: 10-50 записей
- Для получения общего количества записей может потребоваться дополнительный запрос

### Поиск

- Поиск выполняется по частичному совпадению в указанном поле
- Для более точного поиска используйте конкретные термины
- Регистр поиска может зависеть от настроек базы данных

### Обновление данных

- Используйте `update_project` для обновления нескольких полей одновременно
- Используйте `update_project_field` для обновления одного поля
- Оба метода обновляют только переданные поля, остальные остаются неизменными

---

## Примечания

1. Все даты и времена возвращаются в формате ISO 8601
2. UUID должны быть в формате строки (например: `"123e4567-e89b-12d3-a456-426614174000"`)
3. Поля `manager`, `team`, `description`, `status` могут быть `null` или отсутствовать
4. Поле `name` является обязательным и уникальным идентификатором для поиска в `get_project`
5. При создании проекта автоматически генерируются `id`, `created_at` и `updated_at`
6. При обновлении проекта автоматически обновляется `updated_at`

