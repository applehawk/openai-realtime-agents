# WorkflowSteps & PlannedSteps Usage Guide

Документация по использованию полей `plannedSteps` и `workflowSteps` в ответах Supervisor Agent.

**Дата:** 2025-10-22
**Версия:** 3.0 (added plannedSteps for planning complex tasks)

---

## Описание

**Два поля для управления сложными задачами:**

### plannedSteps (NEW in v3.0)
Поле `plannedSteps` в `SupervisorResponse` позволяет supervisor agent **ПЛАНИРОВАТЬ** очень сложные задачи перед выполнением:
- Составить детальный план действий (что будет сделано)
- Показать план пользователю для подтверждения
- Получить одобрение перед выполнением необнеобратимых действий
- Позволить пользователю скорректировать подход

### workflowSteps (since v2.0)
Поле `workflowSteps` в `SupervisorResponse` позволяет supervisor agent **ОТЧИТЫВАТЬСЯ** о выполненных операциях:
- Парсинга и отображения в UI
- Логирования и отладки
- Понимания primary agent'ом того, что было сделано
- Прозрачности для пользователя (можно показать прогресс)

**Ключевое различие:**
- `plannedSteps` = ПЛАН (future tense, до выполнения, для подтверждения)
- `workflowSteps` = ОТЧЁТ (past tense, после выполнения, фактические шаги)

---

## TypeScript Interface

```typescript
export interface SupervisorResponse {
  decision: SupervisorDecision;
  suggestedChanges?: string;
  reasoning: string;
  nextResponse?: string;
  plannedSteps?: string[]; // Optional: PLAN - steps to be executed (before execution, for user confirmation)
  workflowSteps?: string[]; // Optional: REPORT - steps actually taken (after execution)
}
```

**ВАЖНО:** Никогда не используйте оба поля одновременно:
- Если возвращаете `plannedSteps` → НЕ ВЫПОЛНЯЙТЕ задачу, НЕ ДОБАВЛЯЙТЕ `workflowSteps`
- Если возвращаете `workflowSteps` → задача УЖЕ ВЫПОЛНЕНА, НЕ ДОБАВЛЯЙТЕ `plannedSteps`

---

## Когда использовать

### Используйте plannedSteps когда:
- ✅ Очень сложная задача (5+ шагов)
- ✅ Необнеобратимые действия (отправка писем, создание множественных событий)
- ✅ Пользователь может захотеть скорректировать подход
- ✅ Есть неоднозначности, требующие подтверждения
- ✅ Множественные действия, затрагивающие других людей

**Примеры задач для plannedSteps:**
- "Найди всех участников проекта и пригласи на встречу" (отправка писем многим людям)
- "Создай 10 событий на основе расписания в документе" (массовые изменения)
- "Перенеси все встречи на следующую неделю" (необнеобратимые изменения)

### Используйте workflowSteps когда:
- ✅ `decision: "approve"` с multi-step операциями (2-4 шага)
- ✅ Сложные задачи, но низкий риск
- ✅ Пользователь явно хочет немедленного выполнения
- ✅ Операции, где важна прозрачность (для отладки/логов)

**Примеры задач для workflowSteps:**
- "Прочитай письмо от Анны и создай встречу" (execute immediately)
- "Найди информацию о проекте и резюмируй" (analyze and report)

### Не используйте ни одно поле для:
- ⚠️ `decision: "delegateBack"` (simple tasks, no execution by supervisor)
- ⚠️ `decision: "modify"` (no execution yet)
- ⚠️ `decision: "reject"` (no execution)

---

## Формат

### Формат plannedSteps (ПЛАН):

**Каждый step:**
- Язык: **Русский**
- Время: **Будущее** ("Прочитаю", "Создам", "Отправлю")
- Длина: **10-20 слов** (detailed, describes what WILL be done)
- Структура: **Действие + детали + контекст**

**Примеры хороших plannedSteps:**
```json
[
  "Прочитаю письмо от Анны и извлеку предложенное время встречи",
  "Проверю ваш календарь на 15 января в 15:00 на наличие конфликтов",
  "Если время свободно, создам событие в календаре длительностью 1 час",
  "Отправлю email-приглашение Анне на anna@company.com с деталями встречи",
  "Добавлю напоминание за 15 минут до начала встречи"
]
```

**Примеры плохих plannedSteps:**
```json
[
  "Read email",                          // ❌ Not in Russian
  "Прочитаю письмо",                    // ❌ Too vague (from whom? when?)
  "Прочитал письмо от Анны",            // ❌ Past tense (should be future)
  "Шаг 1: чтение письма",               // ❌ Not descriptive
  "Выполняю чтение письма"              // ❌ Present tense (should be future)
]
```

### Формат workflowSteps (ОТЧЁТ):

**Каждый step:**
- Язык: **Русский**
- Время: **Прошедшее** ("Прочитал", "Создал", "Отправил")
- Длина: **5-15 слов** (concise but informative)
- Структура: **Действие + детали**

**Примеры хороших workflowSteps:**
```json
[
  "Прочитал письмо от Анны от 22 января 10:30",
  "Извлёк данные встречи: среда 15 января 15:00, тема 'Проект Восток'",
  "Проверил календарь на 15 января 15:00 — свободно",
  "Создал событие в календаре: среда 15:00-16:00",
  "Отправил email-приглашение Анне (anna@company.com)"
]
```

**Примеры плохих workflowSteps:**
```json
[
  "Read email",                           // ❌ Not in Russian
  "Прочитал",                            // ❌ Too vague (what did you read?)
  "Я прочитал письмо от Анны, отправленное сегодня в 10:30, где она предложила встречу", // ❌ Too long
  "Шаг 1",                               // ❌ No information
  "Выполняю чтение письма"               // ❌ Present tense (should be past)
  "Прочитаю письмо от Анны"              // ❌ Future tense (should be past)
]
```

---

## Примеры использования

### Example 1: Email → Calendar Event

**Request:**
```typescript
{
  conversationContext: "Прочитай письмо от Анны и назначь встречу",
  proposedPlan: "Read email, extract time, create event",
  userIntent: "Schedule meeting from email",
  complexity: "high"
}
```

**Response:**
```typescript
{
  decision: "approve",
  reasoning: "Multi-step: read → extract → schedule",
  nextResponse: "Я прочитал письмо от Анны... [detailed response]",
  workflowSteps: [
    "Прочитал письмо от Анны от 22 января 10:30",
    "Извлёк время встречи: среда 15 января 15:00",
    "Проверил календарь — свободно",
    "Создал событие: среда 15:00-16:00, тема 'Проект Восток'",
    "Отправил приглашение Анне"
  ]
}
```

---

### Example 2: RAG Analysis

**Request:**
```typescript
{
  conversationContext: "Найди письма о проекте Восток и резюмируй",
  proposedPlan: "RAG search + analysis + summary",
  userIntent: "Get project email summary",
  complexity: "high"
}
```

**Response:**
```typescript
{
  decision: "approve",
  reasoning: "Complex RAG + analysis task",
  nextResponse: "Я проанализировал переписку... [detailed response]",
  workflowSteps: [
    "Выполнил RAG запрос: проект 'Восток', период 22 дек - 22 янв",
    "Нашёл 23 письма от 6 участников",
    "Проанализировал тему 1: технические требования (8 писем)",
    "Проанализировал тему 2: бюджет (6 писем)",
    "Проанализировал тему 3: сроки (7 писем)",
    "Извлёк ключевые решения: микросервисы, 2М бюджет",
    "Создал резюме с основными темами"
  ]
}
```

---

### Example 3: Simple Task (no workflowSteps needed)

**Request:**
```typescript
{
  conversationContext: "Прочитай последнее письмо",
  proposedPlan: "Read last email",
  userIntent: "Read email",
  complexity: "low"
}
```

**Response:**
```typescript
{
  decision: "delegateBack",
  reasoning: "Simple single-step task, primary agent can handle",
  nextResponse: "Используй MCP read_email. Ответь: 'Смотрю почту'"
  // NO workflowSteps — delegating back, not executing
}
```

---

## Example 3: PLANNING workflow → approve with plannedSteps (NEW in v3.0)

**Request:**
```typescript
{
  conversationContext: "Пользователь сказал: 'Найди всех участников проекта Восток, проверь их календари и назначь общую встречу'",
  proposedPlan: "RAG поиск участников → проверить календари → найти общее время → создать встречу → отправить приглашения",
  userIntent: "Организовать встречу со всеми участниками проекта",
  complexity: "high"
}
```

**Response (PLAN FIRST - с plannedSteps):**
```typescript
{
  decision: "approve",
  reasoning: "Very complex task with 7+ steps, irreversible actions (sending emails), requires user confirmation.",
  nextResponse: "Я составил план для организации встречи со всеми участниками проекта 'Восток'. Вот что я планирую сделать: найду всех участников через анализ переписки, проверю их календари на следующую неделю, найду время когда все свободны, создам событие и отправлю приглашения. Хотите, чтобы я выполнил этот план? Уточните, пожалуйста, длительность встречи.",
  plannedSteps: [
    "Выполню RAG запрос для поиска всех участников проекта 'Восток' в переписке",
    "Извлеку список участников и их email-адреса из найденных писем",
    "Проверю календарь каждого участника на следующую неделю (пн-пт)",
    "Найду временные слоты, когда все участники свободны одновременно",
    "Предложу пользователю 2-3 оптимальных варианта времени встречи",
    "После выбора времени создам событие в календаре с указанной длительностью",
    "Добавлю всех участников как приглашённых в событие",
    "Отправлю email-приглашения всем участникам с темой и повесткой"
  ]
  // NOTE: NO workflowSteps - nothing executed yet, waiting for user confirmation
}
```

**После подтверждения пользователя, supervisor выполняет план и возвращает:**
```typescript
{
  decision: "approve",
  reasoning: "Executed confirmed plan for organizing team meeting.",
  nextResponse: "Я организовал встречу со всеми участниками проекта 'Восток'. Нашёл шесть участников: Иван, Анна, Пётр, Марина, Сергей и Ольга. Проверил их календари на следующую неделю и нашёл общее свободное время: среда пятнадцатого января в четырнадцать ноль-ноль. Создал событие на два часа и отправил приглашения всем участникам. Все получат email с деталями встречи.",
  workflowSteps: [
    "Выполнил RAG запрос: участники проекта 'Восток'",
    "Нашёл 6 участников: Иван, Анна, Пётр, Марина, Сергей, Ольга",
    "Извлёк email-адреса всех участников",
    "Проверил календари 6 участников на 13-17 января",
    "Нашёл общее свободное время: среда 15 января 14:00",
    "Создал событие: среда 14:00-16:00, тема 'Встреча команды Восток'",
    "Добавил 6 участников в список приглашённых",
    "Отправил email-приглашения всем участникам"
  ]
  // NOTE: NO plannedSteps - plan was already executed
}
```

---

## Парсинг в коде

### Primary Agent может использовать:

```typescript
const supervisorResponse = await callSupervisor(request);

if (supervisorResponse.decision === 'approve') {
  // Check if supervisor is planning or has executed
  if (supervisorResponse.plannedSteps) {
    // PLANNING MODE: Present plan to user for confirmation
    await speakToUser(supervisorResponse.nextResponse);
    console.log('[Supervisor Plan]', supervisorResponse.plannedSteps);

    // Wait for user confirmation, then re-call supervisor to execute
    const userConfirmed = await waitForConfirmation();
    if (userConfirmed) {
      // Call supervisor again to execute the plan
      const executionResponse = await callSupervisor({
        ...request,
        userConfirmedPlan: true
      });
      // Now executionResponse will have workflowSteps
    }
  } else if (supervisorResponse.workflowSteps) {
    // EXECUTION MODE: Task already completed
    await speakToUser(supervisorResponse.nextResponse);
    console.log('[Supervisor Workflow]', supervisorResponse.workflowSteps);
  } else {
    // Simple task, just speak the response
    await speakToUser(supervisorResponse.nextResponse);
  }
}
```

### UI может отображать:

```typescript
// Show planned steps (before execution)
if (response.plannedSteps) {
  response.plannedSteps.forEach((step, index) => {
    console.log(`Planned Step ${index + 1}: ${step}`);
    // Show in UI:
    // ⏱ Выполню RAG запрос для поиска участников
    // ⏱ Извлеку email-адреса участников
    // ⏱ Проверю календари всех участников
    // [Confirm] [Cancel] buttons
  });
}

// Show completed workflow steps (after execution)
if (response.workflowSteps) {
  response.workflowSteps.forEach((step, index) => {
    console.log(`Completed Step ${index + 1}: ${step}`);
    // Show in UI:
    // ✓ Прочитал письмо от Анны
    // ✓ Проверил календарь — свободно
    // ✓ Создал событие
  });
}
```

---

## Best Practices

### For plannedSteps (ПЛАН):

**DO:**
- ✅ Use **future tense** in Russian ("Прочитаю", "Создам", "Отправлю")
- ✅ Include key details (what, who, when, how)
- ✅ Make steps detailed (10-20 words) — user needs to understand the plan
- ✅ Order steps chronologically
- ✅ Make steps clear and actionable
- ✅ Ask for user confirmation in nextResponse
- ✅ Explain conditional logic ("Если время свободно, создам событие")

**DON'T:**
- ❌ Use English or mix languages
- ❌ Use **past tense** ("Прочитал" — wrong for planning!)
- ❌ Make steps too vague ("Выполню задачу")
- ❌ Include workflowSteps when using plannedSteps
- ❌ Execute anything when returning plannedSteps

### For workflowSteps (ОТЧЁТ):

**DO:**
- ✅ Use **past tense** in Russian ("Прочитал", "Создал", "Отправил")
- ✅ Include key details (dates, names, numbers)
- ✅ Keep steps concise (5-15 words)
- ✅ Order steps chronologically
- ✅ Make steps actionable/clear
- ✅ Report what you ACTUALLY did (not what you planned)

**DON'T:**
- ❌ Use English or mix languages
- ❌ Use **future tense** ("Прочитаю" — wrong for reporting!)
- ❌ Use present tense ("Читаю" — wrong!)
- ❌ Make steps too vague ("Выполнил задачу")
- ❌ Make steps too long (>20 words)
- ❌ Include technical jargon ("Вызвал MCP tool")
- ❌ Include plannedSteps when using workflowSteps

---

## Debugging with workflowSteps

**Logs example:**
```
[SupervisorAgent] Decision: approve
[SupervisorAgent] Workflow:
  1. Прочитал письмо от Анны от 22 января 10:30
  2. Извлёк время встречи: среда 15 января 15:00
  3. Проверил календарь — свободно
  4. Создал событие в календаре
  5. Отправил приглашение Анне
[SupervisorAgent] Response: "Я прочитал письмо от Анны..."
```

Это позволяет:
- Понять, что именно сделал supervisor
- Отладить проблемы в multi-step workflows
- Проверить корректность последовательности действий

---

## Future Enhancements

**Возможные улучшения:**

1. **Structured steps with metadata:**
```typescript
workflowSteps: [
  {
    action: "read_email",
    description: "Прочитал письмо от Анны",
    timestamp: "2025-01-22T10:30:00Z",
    details: { from: "anna@company.com", subject: "Встреча" }
  }
]
```

2. **Progress callbacks:**
```typescript
// Supervisor could stream steps as they complete
onStepComplete((step) => {
  console.log(`✓ ${step.description}`);
});
```

3. **UI integration:**
```typescript
// Show live progress in UI
<WorkflowProgress steps={workflowSteps} />
```

---

## Changelog

### v3.0 (2025-10-22) - PLANNING FEATURE
- ✅ Added `plannedSteps` field to `SupervisorResponse` interface
- ✅ Updated `supervisorAgentInstructions` with two modes: PLAN FIRST vs EXECUTE IMMEDIATELY
- ✅ Added detailed planning examples in prompt (Example 6)
- ✅ Updated this usage guide with plannedSteps documentation
- ✅ Added parsing code examples for handling both plannedSteps and workflowSteps
- ✅ Updated Best Practices section with separate DO/DON'T for each field
- ✅ Added Example 3 showing full planning workflow with user confirmation

**Key changes:**
- plannedSteps = PLAN (future tense, before execution, for user confirmation)
- workflowSteps = REPORT (past tense, after execution, actual steps taken)
- Never use both fields in same response

### v2.0 (2025-10-22)
- ✅ Added `workflowSteps` field to `SupervisorResponse` interface
- ✅ Updated `supervisorAgentInstructions` with workflowSteps guidance
- ✅ Added examples in prompt
- ✅ Created this usage guide

---

**Готово!** Теперь supervisor agent может:
1. **ПЛАНИРОВАТЬ** сложные задачи перед выполнением (plannedSteps) — для подтверждения пользователем
2. **ОТЧИТЫВАТЬСЯ** о выполненных операциях (workflowSteps) — для прозрачности и debugging

🎉 Planning feature complete!
