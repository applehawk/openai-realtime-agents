# 🔧 Активные инструменты MCP сервера для интеграции

## 📋 Обзор

В MCP сервере LightRAG сейчас активны **7 инструментов** из 3 категорий:

### ✅ **Query Tools (2 инструмента)**
- `lightrag_query` - Основные RAG запросы
- `lightrag_query_data` - Структурированные данные запросов

### ✅ **Documents Tools (1 инструмент)**  
- `lightrag_insert_text` - Вставка текста в RAG систему

### ✅ **Graph Tools (4 инструмента)**
- `lightrag_search_labels` - Поиск меток в knowledge graph
- `lightrag_check_entity_exists` - Проверка существования entity
- `lightrag_update_entity` - Обновление entity
- `lightrag_update_relation` - Обновление связи между entities
- `lightrag_delete_entity` - Удаление entity
- `lightrag_delete_relation` - Удаление связи

---

## 🔍 Детальное описание инструментов

### 1. **lightrag_query** - RAG запросы
```json
{
  "name": "lightrag_query",
  "description": "Выполнить RAG запрос к LightRAG. Поддерживает различные режимы: local (фокус на конкретных entities), global (анализ паттернов), hybrid (комбинированный), naive (только vector search), mix (рекомендуется - интеграция графа и векторов), bypass (прямой запрос к LLM)",
  "parameters": {
    "query": {
      "type": "string",
      "required": true,
      "description": "Текст запроса (минимум 3 символа)"
    },
    "mode": {
      "type": "string",
      "enum": ["local", "global", "hybrid", "naive", "mix", "bypass"],
      "default": "mix",
      "description": "Режим запроса"
    },
    "include_references": {
      "type": "boolean",
      "default": true,
      "description": "Включить ссылки на источники"
    },
    "response_type": {
      "type": "string",
      "description": "Формат ответа (например 'Multiple Paragraphs', 'Single Paragraph', 'Bullet Points')"
    },
    "top_k": {
      "type": "integer",
      "description": "Количество top entities/relations для извлечения"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Основной инструмент для получения ответов от RAG системы
- Режим `mix` рекомендуется для большинства случаев
- Поддерживает настройку формата ответа и количества результатов

### 2. **lightrag_query_data** - Структурированные данные
```json
{
  "name": "lightrag_query_data",
  "description": "Получить структурированные данные RAG запроса (entities, relationships, chunks) без генерации LLM ответа. Полезно для анализа данных и отладки",
  "parameters": {
    "query": {
      "type": "string",
      "required": true,
      "description": "Текст запроса для анализа"
    },
    "mode": {
      "type": "string",
      "enum": ["local", "global", "hybrid", "naive", "mix", "bypass"],
      "default": "mix",
      "description": "Режим поиска"
    },
    "top_k": {
      "type": "integer",
      "description": "Количество top entities/relationships"
    },
    "chunk_top_k": {
      "type": "integer",
      "description": "Количество text chunks"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Получение сырых данных без LLM обработки
- Анализ структуры knowledge graph
- Отладка и исследование данных

### 3. **lightrag_insert_text** - Вставка текста
```json
{
  "name": "lightrag_insert_text",
  "description": "Вставить текст в RAG систему для последующего поиска и использования",
  "parameters": {
    "text": {
      "type": "string",
      "required": true,
      "description": "Текст для вставки в RAG систему"
    },
    "file_source": {
      "type": "string",
      "default": "",
      "description": "Источник текста (опционально)"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Добавление новых документов в RAG систему
- Обновление базы знаний
- Импорт текстовых данных

### 4. **lightrag_search_labels** - Поиск меток
```json
{
  "name": "lightrag_search_labels",
  "description": "Поиск меток в knowledge graph с нечетким совпадением",
  "parameters": {
    "query": {
      "type": "string",
      "required": true,
      "description": "Поисковый запрос для меток"
    },
    "limit": {
      "type": "integer",
      "default": 100,
      "description": "Максимальное количество результатов (1-1000)"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Поиск существующих entities в knowledge graph
- Исследование структуры данных
- Навигация по графу знаний

### 5. **lightrag_check_entity_exists** - Проверка entity
```json
{
  "name": "lightrag_check_entity_exists",
  "description": "Проверить существование entity с заданным именем в knowledge graph",
  "parameters": {
    "entity_name": {
      "type": "string",
      "required": true,
      "description": "Имя entity для проверки"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Проверка существования entity перед операциями
- Валидация данных
- Предотвращение дублирования

### 6. **lightrag_update_entity** - Обновление entity
```json
{
  "name": "lightrag_update_entity",
  "description": "Обновить свойства entity в knowledge graph",
  "parameters": {
    "entity_name": {
      "type": "string",
      "required": true,
      "description": "Имя entity для обновления"
    },
    "properties": {
      "type": "object",
      "required": true,
      "description": "Новые свойства entity в формате JSON"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Обновление информации об entity
- Корректировка данных в knowledge graph
- Модификация свойств объектов

### 7. **lightrag_update_relation** - Обновление связи
```json
{
  "name": "lightrag_update_relation",
  "description": "Обновить свойства связи между entities в knowledge graph",
  "parameters": {
    "source_entity": {
      "type": "string",
      "required": true,
      "description": "Имя source entity"
    },
    "target_entity": {
      "type": "string",
      "required": true,
      "description": "Имя target entity"
    },
    "relation_type": {
      "type": "string",
      "required": true,
      "description": "Тип связи"
    },
    "properties": {
      "type": "object",
      "required": true,
      "description": "Новые свойства связи в формате JSON"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Обновление связей между entities
- Модификация отношений в knowledge graph
- Корректировка структуры данных

### 8. **lightrag_delete_entity** - Удаление entity
```json
{
  "name": "lightrag_delete_entity",
  "description": "Удалить entity и все её связи из knowledge graph. Необратимая операция!",
  "parameters": {
    "entity_name": {
      "type": "string",
      "required": true,
      "description": "Имя entity для удаления"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Удаление ненужных entities
- Очистка knowledge graph
- Управление данными

### 9. **lightrag_delete_relation** - Удаление связи
```json
{
  "name": "lightrag_delete_relation",
  "description": "Удалить связь между двумя entities из knowledge graph. Необратимая операция!",
  "parameters": {
    "source_entity": {
      "type": "string",
      "required": true,
      "description": "Имя source entity"
    },
    "target_entity": {
      "type": "string",
      "required": true,
      "description": "Имя target entity"
    },
    "relation_type": {
      "type": "string",
      "required": true,
      "description": "Тип связи для удаления"
    },
    "workspace": {
      "type": "string",
      "description": "Имя workspace (опционально)"
    }
  }
}
```

**Использование:**
- Удаление неправильных связей
- Корректировка knowledge graph
- Управление отношениями

---

## 🔧 Технические детали

### API Endpoints
- **Base URL**: `http://79.132.139.57:9621`
- **Timeout**: 120 секунд
- **Max Retries**: 3

### MCP Server
- **Port**: 8000 (HTTP wrapper)
- **Protocol**: MCP over stdio
- **Format**: JSON-RPC

### Workspace Support
Все инструменты поддерживают опциональный параметр `workspace` для изоляции данных.

### Error Handling
Все инструменты возвращают структурированные ошибки в формате:
```json
{
  "error": "Описание ошибки",
  "code": "ERROR_CODE",
  "details": "Дополнительная информация"
}
```

---

## 🚀 Примеры использования

### Базовый RAG запрос
```python
result = await call_tool("lightrag_query", {
    "query": "Что такое машинное обучение?",
    "mode": "mix",
    "include_references": True
})
```

### Анализ данных
```python
data = await call_tool("lightrag_query_data", {
    "query": "машинное обучение",
    "mode": "local",
    "top_k": 10
})
```

### Добавление документа
```python
status = await call_tool("lightrag_insert_text", {
    "text": "Машинное обучение - это подраздел искусственного интеллекта...",
    "file_source": "ml_article.txt"
})
```

### Поиск в knowledge graph
```python
labels = await call_tool("lightrag_search_labels", {
    "query": "машинное обучение",
    "limit": 20
})
```

### Обновление entity
```python
result = await call_tool("lightrag_update_entity", {
    "entity_name": "машинное обучение",
    "properties": {
        "description": "Обновленное описание",
        "category": "AI"
    }
})
```

---

## ⚠️ Важные замечания

1. **Необратимые операции**: `lightrag_delete_entity` и `lightrag_delete_relation` нельзя отменить
2. **Workspace изоляция**: Все операции изолированы по workspace
3. **Валидация**: Все параметры валидируются на сервере
4. **Асинхронность**: Все вызовы асинхронные
5. **Логирование**: Все операции логируются для отладки

---

## 🔄 Интеграция с клиентом

### 1. Подключение к MCP серверу
```python
# Подключение через stdio
async with mcp_client.connect_stdio() as client:
    tools = await client.list_tools()
    # tools будет содержать 7 активных инструментов
```

### 2. Вызов инструментов
```python
# Вызов любого из 7 активных инструментов
result = await client.call_tool("lightrag_query", {
    "query": "ваш запрос",
    "mode": "mix"
})
```

### 3. Обработка результатов
```python
# Все инструменты возвращают TextContent
for content in result:
    if content.type == "text":
        data = json.loads(content.text)
        # Обработка данных
```

---

## 📊 Статистика

- **Всего инструментов**: 7
- **Query tools**: 2
- **Documents tools**: 1  
- **Graph tools**: 4
- **Поддержка workspace**: 100%
- **Асинхронные**: 100%
- **JSON формат**: 100%
