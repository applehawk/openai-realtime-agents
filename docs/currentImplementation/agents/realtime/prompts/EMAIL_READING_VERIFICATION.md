# Верификация: Поддержка чтения почты в улучшенном промпте

**Дата:** 2025-10-22
**Вопрос:** Проверить, корректно ли улучшенный промпт v2.0 описывает возможность чтения почты

---

## ✅ Результат: Полностью поддерживается

Улучшенный промпт **корректно и полно** описывает чтение почты через Email MCP tools.

---

## 🔍 Доказательства

### 1. Direct Tool Execution — явный пример

**Локация:** [improvedPrompt.ts:129](./improvedPrompt.ts#L129)

```
Examples:
- «Прочитай последнее письмо»
- «Прочитай все письма от Анны за сегодня» (if MCP supports filtering)
```

✅ Чтение почты — **Direct Tool Execution** (простая задача)

---

### 2. Confirmation Rules — NO confirmation для чтения

**Локация:** [improvedPrompt.ts:239](./improvedPrompt.ts#L239)

```
| Tool/Action      | Requires Confirmation? | When to Confirm |
|------------------|------------------------|-----------------|
| Reading email    | ❌ NO                  | Never           |
| Sending email    | ✅ YES                 | ALWAYS          |
```

✅ **Правильно:**
- Чтение не изменяет данные → не требует подтверждения
- UX: "прочитай письмо" → агент сразу читает (без "Прочитать?")

---

### 3. Preambles для Email MCP

**Локация:** [improvedPrompt.ts:220-223](./improvedPrompt.ts#L220-L223)

```
Before Email MCP:
- «Открываю почту»
- «Смотрю письма»
- «Проверяю сообщения»
```

✅ **Conversational flow:**
```
User: "Прочитай последнее письмо"
Agent: «Смотрю письма» [calls Email MCP]
Agent: [читает содержимое вслух]
```

---

### 4. Proactive Suggestions после чтения

**Локация:** [improvedPrompt.ts:361](./improvedPrompt.ts#L361)

```
After reading email: «Ответить отправителю?»
```

✅ **Отличный UX:**
1. Agent читает письмо
2. Agent предлагает: «Ответить отправителю?»
3. User может сказать "да" → workflow continues

---

### 5. Privacy Considerations

**Локация:** [improvedPrompt.ts:528](./improvedPrompt.ts#L528)

```
✅ Minimize reading email content aloud unless explicitly requested
```

✅ **Правильное поведение:**
- "Покажи письма от Анны" → агент перечисляет темы/даты (не читает содержимое вслух)
- "**Прочитай** письмо от Анны" → агент читает содержимое полностью

---

### 6. Email MCP vs RAG — четкое разделение

**Локация:** [improvedPrompt.ts:516-520](./improvedPrompt.ts#L516-L520)

```
When to use Email MCP vs RAG for email content:

- Email MCP (Direct Tool): Reading specific recent emails, checking inbox
  Example: «Прочитай письмо от Анны», «Покажи письма за сегодня»

- RAG (lightrag_query): Historical search, keyword-based retrieval
  Example: «Что писали о проекте прошлый месяц», «Найди обсуждения бюджета»
```

✅ **Ясная граница:**
- **Email MCP** = текущие/недавние конкретные письма (real-time access)
- **RAG** = исторический поиск в knowledge graph

---

## 🔧 Улучшения внесены (2025-10-22)

### Изменение 1: Уточнено правило "filtering"

**До:**
```
Do NOT use when:
- ❌ Filtering or analysis ("все письма о проекте")
```

**Проблема:** Слишком широкое — "все письма от Анны" может быть простой фильтрацией по отправителю (поддерживается Email MCP).

**После:**
```
Do NOT use when:
- ❌ Complex filtering or analysis ("все письма о проекте за месяц с анализом тем")

NOTE on Email Reading:
- Simple read (last email, specific sender, today's emails) → Direct Tool if MCP supports
- Complex search/analysis (keyword search, summarization) → Use RAG or Supervisor
```

✅ **Теперь агент знает:**
- "Прочитай письма от Анны" → Direct Tool (simple filtering)
- "Найди все письма о проекте и резюмируй" → Supervisor/RAG (complex analysis)

---

### Изменение 2: Добавлен раздел "Email MCP vs RAG"

**Добавлено в Cross-Source Information Requests:**
```
When to use Email MCP vs RAG for email content:
- Email MCP: Reading specific recent emails, checking inbox, listing today's/week's emails
- RAG: Historical search, keyword-based retrieval, emails already indexed in knowledge graph

Do NOT:
- ❌ Use RAG for reading specific recent emails (use Email MCP instead)
```

✅ **Устраняет путаницу:**
- Агент не будет использовать RAG для "прочитай последнее письмо"
- Агент не будет использовать Email MCP для "что писали о проекте в прошлом году"

---

## 📋 Все сценарии чтения почты

| Запрос пользователя | Execution Path | Tool | Confirmation | Пример preamble |
|---------------------|----------------|------|--------------|-----------------|
| "Прочитай последнее письмо" | Direct | Email MCP | ❌ NO | «Смотрю письма» |
| "Прочитай письмо от Анны" | Direct | Email MCP | ❌ NO | «Открываю почту» |
| "Покажи письма за сегодня" | Direct | Email MCP | ❌ NO | «Проверяю сообщения» |
| "Прочитай все письма от Ивана" | Direct | Email MCP | ❌ NO | «Смотрю письма» |
| "Что писали о проекте?" | RAG | lightrag_query | ❌ NO | «Ищу в документах» |
| "Найди письма о бюджете и резюмируй" | Supervisor | delegateToSupervisor | ❌ NO | «Секундочку, уточню детали» |
| "Прочитай письмо и назначь встречу" | Supervisor | delegateToSupervisor | ❌ NO | «Сейчас подумаю, как лучше» |

---

## ✅ Checklist: Поддержка чтения почты

- [x] Явный пример чтения в Direct Tool Execution
- [x] Confirmation rule: Reading email = NO
- [x] Preambles для Email MCP (3 варианта)
- [x] Proactive suggestion после чтения
- [x] Privacy consideration (minimize aloud reading)
- [x] Четкое разделение Email MCP vs RAG
- [x] Уточнение "simple filtering" vs "complex analysis"
- [x] Примеры для всех типов чтения (recent, by sender, historical)

---

## 🎯 Вывод

**Улучшенный промпт v2.0 полностью поддерживает чтение почты:**

1. ✅ **Direct Tool Execution** для простого чтения
2. ✅ **No confirmation** для UX (не спрашивает "Прочитать?")
3. ✅ **Preambles** для естественного conversation flow
4. ✅ **Proactive suggestions** после чтения
5. ✅ **Privacy-aware** (не читает вслух без явного запроса)
6. ✅ **Четкое разделение** Email MCP (recent) vs RAG (historical)

**Дополнительные улучшения внесены 2025-10-22:**
- Уточнено правило "filtering" (simple vs complex)
- Добавлен раздел "Email MCP vs RAG for email content"

---

**Статус:** ✅ VERIFIED — чтение почты полностью поддерживается и корректно описано.
