# Гайд по тестированию проекта

## Философия подхода

Мы выбрали **базовый вариант без оверинжиниринга**: простые, быстрые тесты для критичных частей системы, которые защищают от регрессий при обновлениях.

## Инфраструктура

### Установка

```bash
npm install
```

### Запуск тестов

```bash
npm test              # Запуск всех тестов
npm test -- --watch   # Режим watch (автозапуск при изменениях)
```

### Конфигурация

Файл `vitest.config.ts` настроен для:
- Node.js окружения (для API routes)
- Автоматического поиска файлов `*.test.{ts,tsx}` в `src/`
- Базового coverage отчёта

## Что тестируем

### 1. API Routes (приоритет #1)

**Почему:** API routes — это точки входа, которые напрямую влияют на работу агентов и пользователей.

**Пример:** `src/app/api/preferences-mcp/route.test.ts`

**Что проверяем:**
- ✅ Успешные запросы (200 OK)
- ✅ Обработка ошибок соединения (503 Service Unavailable)
- ✅ Health checks (GET endpoints)
- ✅ Валидация входных данных
- ✅ Правильная прокси-логика к внешним сервисам

**Паттерн тестирования:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST, GET } from './route';

// Мокаем fetch для внешних вызовов
global.fetch = vi.fn().mockResolvedValue(...);

// Тестируем обработку запросов
const response = await POST(mockRequest);
const data = await response.json();
expect(data.success).toBe(true);
```

### 2. Tool Functions (приоритет #2)

**Почему:** Tools — это логика, которую вызывают агенты. Сломанный tool = сломанный сценарий.

**Где искать:**
- `src/app/agentConfigs/*/tools/**/*.ts`
- `src/app/api/supervisor/**/*.ts`

**Что проверяем:**
- ✅ Валидация параметров
- ✅ Обработка ошибок
- ✅ Формат возвращаемых данных
- ✅ Интеграция с внешними API (через моки)

**Пример структуры:**
```typescript
describe('updatePreferencesTool', () => {
  it('валидирует обязательные поля', () => {
    // ...
  });
  
  it('возвращает ошибку при невалидных данных', () => {
    // ...
  });
  
  it('успешно обновляет предпочтения', async () => {
    // ...
  });
});
```

### 3. Agent Configs (приоритет #3)

**Почему:** Конфигурации агентов содержат промпты и инструменты. Ошибки здесь ломают весь сценарий.

**Что проверяем:**
- ✅ Все агенты имеют обязательные поля (`name`, `instructions`, `tools`)
- ✅ Handoffs указывают на существующие агенты
- ✅ Tools определены корректно (schema валидна)

**Подход:** Статическая валидация через TypeScript + простые smoke-тесты.

## Структура тестов

### Именование файлов

- Тесты рядом с кодом: `route.test.ts`, `tool.test.ts`
- Или в папке `__tests__/` рядом с исходником

### Структура теста

```typescript
describe('название модуля', () => {
  beforeEach(() => {
    // Подготовка: моки, очистка состояния
  });

  afterEach(() => {
    // Очистка после теста
  });

  it('описание что проверяем', async () => {
    // Arrange: подготовка данных
    // Act: выполнение действия
    // Assert: проверка результата
  });
});
```

## Моки и заглушки

### Мокирование fetch

```typescript
// Успешный ответ
global.fetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
);

// Ошибка соединения
global.fetch = vi.fn().mockRejectedValue(
  new Error('Failed to fetch')
);
```

### Мокирование NextRequest

```typescript
const mockRequest = {
  json: vi.fn().mockResolvedValue({ tool_name: 'test' }),
} as unknown as NextRequest;
```

## Что НЕ тестируем (пока)

- ❌ LLM-ответы напрямую (слишком нестабильно)
- ❌ Полные E2E сценарии (требует инфраструктуры)
- ❌ UI компоненты (можно добавить позже с React Testing Library)
- ❌ Интеграции с реальными внешними сервисами (только моки)

## Следующие шаги

### Немедленно (критично)

1. **Добавить тесты для остальных API routes:**
   - `src/app/api/rag/route.ts`
   - `src/app/api/interview/route.ts`
   - `src/app/api/supervisor/unified/route.ts`

2. **Добавить тесты для tool functions:**
   - `src/app/agentConfigs/severstalAssistantAgent/tools/**/*.ts`

### Средний приоритет

3. **Валидация agent configs:**
   - Проверка что все handoffs валидны
   - Проверка что все tools определены

4. **Smoke-тесты для критичных сценариев:**
   - Интервью: создание → вопросы → завершение
   - Проекты: создание → обновление → завершение
   - RAG: запрос → поиск → ответ

### Низкий приоритет (когда понадобится)

5. **E2E тесты** (Playwright/Cypress)
6. **LLM-регрессия** (золотые диалоги + LLM-as-judge)
7. **Coverage отчёты** (уже настроено, можно улучшить)

## Примеры

### Полный пример теста API route

См. `src/app/api/preferences-mcp/route.test.ts` — там реализованы все паттерны:
- Мокирование fetch
- Тестирование успешных запросов
- Тестирование ошибок
- Тестирование health checks

## Полезные команды

```bash
# Запуск тестов один раз
npm test

# Watch режим
npm test -- --watch

# Запуск конкретного файла
npm test -- route.test.ts

# С coverage
npm test -- --coverage

# Только изменённые файлы (в watch режиме)
npm test -- --changed
```

## Troubleshooting

### Тесты не находят модули

- Убедитесь что файл называется `*.test.{ts,tsx}`
- Проверьте что файл в папке `src/`

### Проблемы с моками

- Используйте `vi.restoreAllMocks()` в `beforeEach`
- Восстанавливайте `global.fetch` в `afterEach`

### TypeScript ошибки

- Убедитесь что типы из `next/server` импортированы
- Используйте `as unknown as Type` для моков когда нужно

## Контакты и вопросы

Если нужно расширить тестирование или добавить новые типы тестов — обсудим в команде.

---

**Последнее обновление:** 2025-11-12  
**Статус:** Базовый вариант реализован, готов к расширению

