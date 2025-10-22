# Глубокий анализ `russianAssistantPrompt`

## Резюме

Проведен анализ промпта на соответствие best practices из [OpenAI Realtime API Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide).

**Общая оценка:** 6/10
**Критические проблемы:** 10
**Рекомендуемые улучшения:** 23

---

## Критические проблемы

### 1. ❌ Role ограничивает функциональность агента

**Текущая версия:**
```
You are an expert real-time Russian-language voice and chat assistant
specializing in email and calendar management.
```

**Проблема:**
Агент замыкается только на email/calendar, хотя у него есть:
- RAG для поиска в документах и заметках
- Supervisor delegation для сложных задач любого типа
- Потенциал отвечать на общие вопросы

**Impact:** Агент может отказывать в валидных задачах (например, "найди информацию о проекте в документах" или "помоги с анализом данных").

**Решение:**
Переформулировать как универсального ассистента с **основным фокусом** на email/calendar, но открытого для делегирования других задач.

---

### 2. ❌ Отсутствие явных "Use when" / "Do NOT use when" правил

**Текущее состояние:**
Есть описание трех execution paths, но нет четких границ **когда НЕ использовать** каждый инструмент.

**Проблема:**
Best practice требует explicit rules для каждого tool:
- "Use ONLY when..."
- "Do NOT use when..."
- "If uncertain, prefer..."

**Impact:** Модель может:
- Вызывать calendar MCP для RAG-задач
- Делегировать supervisor для простых задач
- Использовать RAG для текущих событий календаря

**Решение:**
Добавить матрицу decision-making с четкими границами.

---

### 3. ❌ Отсутствие preambles для всех tool calls

**Текущее состояние:**
Есть только для supervisor delegation:
```
«Секундочку, уточню детали», «Один момент, проверю», «Сейчас подумаю, как лучше»
```

**Проблема:**
Нет preambles для:
- Calendar MCP tools (checking events, scheduling)
- Email MCP tools (reading, sending)
- RAG queries (searching knowledge base)

**Impact:**
Агент вызывает tools молча, что создает awkward паузы и плохой UX.

**Решение:**
Добавить короткие фразы (1-3 слова) перед каждым типом tool call.

---

### 4. ❌ Нет pronunciation guides для технических терминов

**Текущее состояние:**
Промпт использует термины без фонетических гидов:
- MCP
- LightRAG
- RAG
- mode="mix", mode="local", etc.

**Проблема:**
Голосовой агент может:
- Произносить акронимы как слова ("эм-си-пи" vs "мсп")
- Некорректно произносить технические термины
- Путать пользователя неестественным произношением

**Решение:**
Добавить секцию Reference Pronunciations:
```
MCP → "эм-си-пи" (произносить по буквам)
LightRAG → "лайтраг" (одним словом)
```

---

### 5. ❌ Параграфы вместо bullets в критичных секциях

**Текущее состояние:**
Секции написаны длинными параграфами:

```
The assistant should greet users briefly in Russian and indicate readiness to help with email or calendar tasks. When user intent is unclear, the assistant should ask short, targeted clarifying questions in Russian...
```

**Проблема:**
Best practice: **"Prefer bullets over paragraphs"**
Модель лучше понимает и следует bullet points, чем dense text.

**Impact:**
Модель может пропускать важные инструкции, "захороненные" в середине параграфа.

**Решение:**
Конвертировать все инструкции в bullet format.

---

### 6. ❌ Отсутствие sample phrases с вариативностью

**Текущее состояние:**
Нет примеров фраз для:
- Greetings: «Здравствуйте! Чем помочь?»
- Acknowledgments: «Понял», «Хорошо», «Записал»
- Clarifications: «Уточните, пожалуйста...», «Не совсем понял...»
- Bridges: «Смотрю», «Проверяю», «Ищу»
- Closers: «Готово!», «Сделано», «Всё настроил»

**Проблема:**
Без примеров модель может:
- Звучать роботизированно
- Использовать однообразные фразы
- Не соответствовать целевому tone (friendly, upbeat)

**Impact:**
Плохой conversational flow, низкая вовлеченность пользователя.

**Решение:**
Добавить секцию Sample Phrases с вариациями и пометкой:
**"DO NOT ALWAYS USE THESE EXAMPLES, VARY YOUR RESPONSES"**

---

### 7. ❌ Unclear escalation logic

**Текущее состояние:**
Нет определения, когда делегировать при ошибках:
- Сколько попыток перед escalation?
- Что делать при repeated tool failures?
- Когда сообщить об ошибке vs retry?

**Проблема:**
Best practice требует explicit escalation triggers:
- After 2-3 failed tool calls → delegate to supervisor
- After supervisor failure → inform user honestly
- Safety/privacy concerns → immediate escalation

**Impact:**
Агент может:
- Бесконечно повторять неудачные вызовы
- Не сообщать пользователю о проблемах
- Не делегировать, когда нужно

**Решение:**
Добавить секцию Escalation & Error Handling с четкими triggers.

---

### 8. ❌ Conflicting instructions

**Выявленные конфликты:**

1. **Длина ответов:**
   ```
   "maintain responses between 5-20 words"
   vs
   "summarize findings conversationally"
   ```
   Резюме RAG-результатов не уместится в 5-20 слов.

2. **Подтверждение vs friction:**
   ```
   "Before executing actions... confirm with the user"
   vs
   "minimizing user friction"
   ```
   Неясно, какие действия требуют подтверждения.

3. **Brevity vs completeness:**
   ```
   "splitting longer information across multiple turns"
   vs
   "Before executing actions... confirm"
   ```
   Как подтвердить действие, если информация разбита на несколько turns?

**Impact:**
Модель может выбрать неправильное поведение в критичных ситуациях.

**Решение:**
Разрешить конфликты через приоритизацию и per-scenario rules.

---

### 9. ❌ Отсутствие per-tool confirmation rules

**Текущее состояние:**
Общая фраза: "Before executing actions that send emails or schedule events, the assistant should confirm with the user."

**Проблема:**
Неясно для многих действий:

| Действие | Требует подтверждения? | Текущий статус |
|----------|------------------------|----------------|
| Отправка email | ДА | ✅ Указано |
| Создание события | ДА | ✅ Указано |
| Чтение email | НЕТ | ❌ Не указано |
| Просмотр календаря | НЕТ | ❌ Не указано |
| Удаление события | ДА | ❌ Не указано |
| RAG query | НЕТ | ❌ Не указано |
| Supervisor delegation | НЕТ | ❌ Не указано |

**Impact:**
Агент может:
- Спрашивать подтверждение для чтения (плохой UX)
- Не спрашивать подтверждение для удаления (опасно)

**Решение:**
Создать explicit per-tool confirmation matrix.

---

### 10. ❌ Нет handling для state transitions

**Текущее состояние:**
Промпт не описывает поведение при:
- Возврате от supervisor delegation
- Переключении между execution paths
- Изменении context через session.update

**Проблема:**
После delegation агент может:
- Забыть предыдущий контекст
- Повторить информацию
- Не знать, как продолжить диалог

**Impact:**
Неестественный conversation flow после сложных операций.

**Решение:**
Добавить секцию State Management с правилами transitions.

---

## Матрица соответствия Best Practices

| Best Practice | Текущий статус | Приоритет |
|---------------|----------------|-----------|
| Labeled sections | ✅ Есть | — |
| Bullets over paragraphs | ❌ Параграфы | 🔴 HIGH |
| Sample phrases with variety | ❌ Отсутствуют | 🔴 HIGH |
| Pronunciation guides | ❌ Отсутствуют | 🟡 MEDIUM |
| Tool preambles | ⚠️ Частично | 🔴 HIGH |
| Per-tool confirmation rules | ⚠️ Неполные | 🔴 HIGH |
| "Use when" / "Do NOT use when" | ⚠️ Неполные | 🔴 HIGH |
| Escalation triggers | ❌ Отсутствуют | 🟡 MEDIUM |
| State machine approach | ❌ Отсутствует | 🟢 LOW |
| Conflict resolution | ❌ Конфликты | 🔴 HIGH |
| Brevity constraints | ⚠️ Слишком жестко | 🟡 MEDIUM |
| Language pinning | ✅ Есть | — |
| Unclear audio handling | ❌ Отсутствует | 🟡 MEDIUM |

---

## Рекомендации по улучшению (приоритизированные)

### 🔴 HIGH Priority (критично для качества)

1. **Переформулировать Role** — убрать ограничение только на email/calendar
2. **Добавить explicit tool selection matrix** — "Use ONLY when" / "Do NOT use when"
3. **Добавить preambles для всех tools** — короткие фразы перед каждым вызовом
4. **Конвертировать параграфы в bullets** — улучшить читаемость для модели
5. **Добавить sample phrases** — greetings, acknowledgments, bridges, closers
6. **Создать per-tool confirmation matrix** — четко определить, что требует подтверждения
7. **Разрешить conflicting instructions** — приоритизация и per-scenario rules

### 🟡 MEDIUM Priority (важно для UX)

8. **Добавить pronunciation guides** — фонетика для MCP, RAG, LightRAG
9. **Определить escalation triggers** — когда делегировать при ошибках
10. **Смягчить brevity constraint** — 5-20 слов слишком жестко, нужен adaptive approach
11. **Добавить unclear audio handling** — что делать при unintelligible input
12. **Добавить state transition rules** — как вести себя после delegation

### 🟢 LOW Priority (nice-to-have)

13. **Реализовать state machine** — формализовать conversation states
14. **Добавить session.update handling** — динамическая смена instructions
15. **Оптимизировать для iteration** — разметить части промпта для A/B testing

---

## Структура улучшенного промпта

Предлагаемая структура согласно best practices:

```
1. Role & Objective — расширить на универсального ассистента
2. Personality & Tone — sample phrases, pacing, brevity (adaptive)
3. Reference Pronunciations — MCP, RAG, термины
4. Language Control — Russian-only, handling других языков
5. Tools Overview — краткое описание трех execution paths
6. Tool Selection Matrix — explicit "Use when" / "Do NOT use when"
7. Tool Call Behavior — preambles, confirmation rules per-tool
8. Conversation Flow — greetings, clarifications, acknowledgments
9. Response Formatting — numbers, dates, times для голоса
10. State Management — transitions, delegation/return handling
11. Escalation & Error Handling — triggers, recovery strategies
12. Edge Cases — specific scenarios с решениями
13. Safety & Privacy — когда не выполнять действия
```

---

## Метрики успеха после улучшения

**Целевые показатели:**

- **Tool selection accuracy:** 95%+ правильный выбор execution path
- **Confirmation clarity:** 100% критичных действий с подтверждением
- **Conversation naturalness:** >4.5/5 по user ratings
- **Error recovery rate:** <2 попытки до successful escalation
- **Language consistency:** 100% Russian (нет переключений)

---

## Следующие шаги

1. ✅ Создать улучшенную версию промпта
2. ⬜ Провести A/B testing со старой версией
3. ⬜ Собрать user feedback на naturalness
4. ⬜ Измерить tool selection accuracy
5. ⬜ Итерировать на основе данных

---

**Дата анализа:** 2025-10-22
**Версия промпта:** v1.0 (current)
**Рекомендуемая версия:** v2.0 (см. улучшенный промпт)
