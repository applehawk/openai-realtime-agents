# Interview Tools - Best Practices & Architecture Recommendations

## 📋 Executive Summary

**Проблема**: Текущая реализация interview tools содержит 360+ строк бизнес-логики на client-side, что нарушает OpenAI best practices и приводит к:
- Увеличенному использованию токенов
- Сложности тестирования
- Проблемам с безопасностью (RAG вызовы из браузера)
- Отсутствию strict mode в schemas

**Решение**: Миграция на гибридную архитектуру с разделением ответственности:
- **Client-side**: 2 простых tools (~35 строк) - только API вызовы
- **Server-side**: Вся бизнес-логика в `/api/interview`
- **Объединение tools**: validate + save в один tool (следуя OpenAI best practice)

**Результат**:
- ✅ Соответствие OpenAI best practices ("Combine functions that are always called in sequence")
- ✅ ~30% экономия токенов (меньше tools = меньше schemas)
- ✅ **50% меньше latency** (1 tool call вместо 2)
- ✅ Улучшенная безопасность и тестируемость
- ✅ Возможность повторного использования API
- ✅ Атомарность операций (validation + save в одной транзакции)

**Рекомендуемый план**: Вариант B (правильный рефакторинг) для dev, Вариант C (постепенная миграция) для production

---

## 📖 Table of Contents

1. [Текущая архитектура Interview System](#текущая-архитектура-interview-system)
2. [Рекомендация: Гибридный подход](#рекомендация-гибридный-подход)
3. [Детальное обоснование](#детальное-обоснование)
4. [Предлагаемая архитектура для Interview Tools](#предлагаемая-архитектура-для-interview-tools)
5. [Преимущества этого подхода](#преимущества-этого-подхода)
6. [Сравнение с текущей реализацией](#сравнение-с-текущей-реализацией)
7. [Пример использования модели](#пример-использования-модели)
8. [План миграции](#план-миграции)
   - [Вариант А: Минимальный рефакторинг](#вариант-а-минимальный-рефакторинг-быстро-1-2-часа)
   - [Вариант Б: Правильный рефакторинг](#вариант-б-правильный-рефакторинг-рекомендуется-3-4-часа)
   - [Вариант C: Постепенная миграция](#вариант-c-постепенная-миграция-рекомендуется-для-production)
9. [Чек-лист перед началом](#чек-лист-перед-началом)
10. [Метрики для мониторинга](#метрики-для-мониторинга-после-миграции)

---

## Текущая архитектура Interview System

### Разделение по агентам:

**Router Agent** (`routerAgent`):
- Использует `getCurrentUserInfo` tool из `userInfoTool.ts`
- Получает информацию о пользователе (userId, username, email, position)
- Определяет, нужно ли запускать интервью
- Делегирует работу `interviewAgent` при необходимости

**Interview Agent** (`interviewAgent`):
- Использует 3 специализированных tools:
  1. `startInitialInterview` - начать/возобновить интервью
  2. `conductInitialInterview` - основная логика проведения интервью (220+ строк)
  3. `validateInterviewAnswer` - валидация качества ответов через `/api/validate-answer`

**Существующие API endpoints:**
- `/api/auth/me` - получение данных пользователя (используется в `getCurrentUserInfo`)
- `/api/interview` - проверка статуса интервью, сохранение данных
- `/api/validate-answer` - валидация ответов через supervisor model
- `/api/rag` - взаимодействие с RAG MCP server

---

## Рекомендация: **Гибридный подход** 🎯

Исходя из архитектуры проекта и документации OpenAI, рекомендую **комбинированный подход**:

### 1. **Оставить простые tools на client-side** (Realtime API)
### 2. **Вынести сложную логику на server-side** (как в `/api/responses`)

---

## Детальное обоснование:

### Текущая архитектура проекта показывает паттерн:

**✅ Client-side tools** (выполняются в браузере):
- Простые операции
- Быстрый отклик
- Минимальная логика

**✅ Server-side API** (выполняются на сервере):
- У вас уже есть `/api/interview/route.ts` с логикой проверки статуса
- `/api/responses/route.ts` для supervisor паттерна
- `/api/validate-answer/route.ts` для валидации

---

## Предлагаемая архитектура для Interview Tools:

### Сохраняем существующее разделение агентов:

#### **Router Agent tools** (уже правильно реализован):
```typescript
// userInfoTool.ts - простой и эффективный
export const getCurrentUserInfo = tool({
  name: 'getCurrentUserInfo',
  description: 'Получить информацию о текущем пользователе из сессии',
  strict: true, // ← ДОБАВИТЬ
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    // ... rest of the logic
  },
});
```

#### **Interview Agent tools** (упрощённые):

```typescript
// 1. Начало интервью - УПРОСТИТЬ
export const startInitialInterview = tool({
  name: 'startInitialInterview',
  description: 'Начать или продолжить интервью с пользователем для сбора предпочтений',
  strict: true, // ← ДОБАВИТЬ
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'ID пользователя' },
      userPosition: { type: 'string', description: 'Должность пользователя' },
    },
    required: ['userId', 'userPosition'],
    additionalProperties: false,
  },
  execute: async (input) => {
    // Простой вызов API - вся логика проверки статуса на сервере
    const response = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_or_resume',
        userId: input.userId,
        userPosition: input.userPosition,
      }),
    });
    return await response.json();
  },
});

// 2. Сохранение ответа с автоматической валидацией - НОВЫЙ, УПРОЩЁННЫЙ TOOL
export const saveInterviewAnswer = tool({
  name: 'saveInterviewAnswer',
  description: `Сохранить ответ пользователя на вопрос интервью с автоматической валидацией.

Инструмент автоматически:
1. Валидирует качество ответа (достаточность, релевантность)
2. Сохраняет ответ если он валиден
3. Возвращает следующий вопрос или завершает интервью

При невалидном ответе возвращает suggestion для переформулировки вопроса.`,
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'ID пользователя' },
      questionId: {
        type: 'string',
        enum: ['1', '2', '3', '4', '5', '6', '7'],
        description: 'Номер текущего вопроса (1-7)',
      },
      answer: { type: 'string', description: 'Ответ пользователя на вопрос' },
      userPosition: {
        type: 'string',
        description: 'Должность пользователя (для персонализации следующего вопроса)'
      },
    },
    required: ['userId', 'questionId', 'answer', 'userPosition'],
    additionalProperties: false,
  },
  execute: async (input) => {
    // Один вызов API - валидация + сохранение + следующий вопрос
    const response = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_answer',
        userId: input.userId,
        questionId: input.questionId,
        answer: input.answer,
        userPosition: input.userPosition,
      }),
    });
    return await response.json();
  },
});

// ❌ УДАЛИТЬ validateInterviewAnswer tool - логика встроена в saveInterviewAnswer
```

**Обоснование объединения** (OpenAI Best Practice):

> **"Combine functions that are always called in sequence"**
>
> If you always call `mark_location()` after `query_location()`, just move the marking logic into the query function call.

В нашем случае:
- `validateInterviewAnswer` ВСЕГДА вызывается перед `saveInterviewAnswer`
- Они работают с одними и теми же данными (questionId, answer)
- Валидация нужна только для того, чтобы решить, сохранять ли ответ

**Преимущества объединения**:
1. ✅ Меньше tool calls (1 вместо 2)
2. ✅ Меньше latency
3. ✅ Атомарная операция (валидация + сохранение)
4. ✅ Проще для модели (один tool вместо двух)
5. ✅ Меньше токенов в context (один schema вместо двух)

```

### **Server-side API** (`/api/interview/route.ts`) - РАСШИРИТЬ:

```typescript
// Добавить новый action для обработки ответа
export async function POST(request: NextRequest) {
  try {
    // Аутентификация
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const user = await authClient.getCurrentUser(accessToken);
    const userId = user.id || user.username;

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'check_status':
        return await checkInterviewStatus(userId); // ← УЖЕ РЕАЛИЗОВАНО

      case 'save_data':
        return await saveInterviewDataHandler(userId, data); // ← УЖЕ РЕАЛИЗОВАНО

      case 'create_workspace':
        return await createWorkspace(userId); // ← УЖЕ РЕАЛИЗОВАНО

      case 'start_or_resume':
        return await handleStartOrResume(userId, data); // ← НОВОЕ

      case 'process_answer':
        return await handleProcessAnswer(userId, data); // ← НОВОЕ
    }
  } catch (error) {
    console.error('Interview API error:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

// НОВАЯ ФУНКЦИЯ: начало/возобновление интервью
async function handleStartOrResume(userId: string, data: any) {
  const { userPosition } = data;

  // Используем существующую логику checkInterviewStatus
  const statusResult = await checkInterviewStatusInternal(userId);

  if (statusResult.hasInterview && statusResult.completeness === 100) {
    return NextResponse.json({
      status: 'already_completed',
      message: 'ok', // Молча продолжить
    });
  }

  if (statusResult.hasInterview && statusResult.completeness < 100) {
    // Возобновить с первого незаполненного вопроса
    const nextQuestionId = getNextMissingQuestion(statusResult.missingFields);
    const nextQuestionText = getQuestionText(nextQuestionId, userPosition);

    return NextResponse.json({
      status: 'resume',
      message: `Продолжаем интервью с вопроса ${nextQuestionId}`,
      questionId: nextQuestionId,
      question: nextQuestionText,
      progress: `${statusResult.filledFields}/7`,
    });
  }

  // Начать новое интервью
  const firstQuestionText = getQuestionText('1', userPosition);

  return NextResponse.json({
    status: 'started',
    message: 'Начинаем интервью',
    questionId: '1',
    question: firstQuestionText,
    progress: '0/7',
  });
}

// НОВАЯ ФУНКЦИЯ: обработка ответа с валидацией и определением следующего вопроса
async function handleProcessAnswer(userId: string, data: any) {
  const { questionId, answer, userPosition } = data;

  // 1. Валидация через существующий API endpoint (опционально)
  const validation = await validateAnswerQuality(questionId, answer);

  if (!validation.isValid) {
    return NextResponse.json({
      status: 'invalid_answer',
      reason: validation.reason,
      suggestion: validation.suggestion,
      retry: true,
    });
  }

  // 2. Сохранение ответа в временное хранилище (Redis/памяти)
  await saveAnswerToState(userId, questionId, answer);

  // 3. Проверить, все ли вопросы отвечены
  const answeredQuestions = await getAnsweredQuestions(userId);

  if (answeredQuestions.length === 7) {
    // Все вопросы отвечены - сохранить в RAG
    const interviewSummary = buildInterviewSummary(userId, answeredQuestions, userPosition);
    await createUserWorkspace(userId);
    await saveInterviewDataToRag(userId, interviewSummary);

    // Очистить временное хранилище
    await clearAnswerState(userId);

    return NextResponse.json({
      status: 'completed',
      message: 'Интервью завершено! Ваши предпочтения сохранены.',
    });
  }

  // 4. Определить следующий вопрос
  const nextQuestionId = getNextQuestionId(answeredQuestions);
  const nextQuestionText = getQuestionText(nextQuestionId, userPosition);

  return NextResponse.json({
    status: 'in_progress',
    message: 'Ответ сохранён',
    questionId: nextQuestionId,
    question: nextQuestionText,
    progress: `${answeredQuestions.length}/7`,
  });
}

// Helper functions
function getQuestionText(questionId: string, userPosition: string): string {
  const questions = {
    '1': `Я вижу, что ваша должность — ${userPosition}. Обычно на этой позиции специалисты разбираются в нескольких ключевых областях. Подтверждаете? Есть ли другие темы, в которых вы эксперт?`,
    '2': 'Как мне лучше с вами общаться? Предпочитаете официальный деловой тон или более неформальный?',
    '3': 'В какие дни недели и время дня вам удобнее назначать встречи?',
    '4': 'Когда вам важно работать без отвлечений?',
    '5': 'Вы предпочитаете сосредоточиться на одной задаче или работать над несколькими проектами параллельно?',
    '6': 'Какие у вас профессиональные цели на ближайший год?',
    '7': 'Когда сталкиваетесь со сложной задачей, вы предпочитаете сначала сами все проработать или обсудить с коллегами?',
  };
  return questions[questionId] || '';
}

function getNextQuestionId(answeredQuestions: string[]): string {
  const allQuestions = ['1', '2', '3', '4', '5', '6', '7'];
  return allQuestions.find(q => !answeredQuestions.includes(q)) || '1';
}

function getNextMissingQuestion(missingFields: string[]): string {
  const fieldToQuestion = {
    'компетенции': '1',
    'стиль общения': '2',
    'предпочтения для встреч': '3',
    'фокусная работа': '4',
    'стиль работы': '5',
    'карьерные цели': '6',
    'подход к решению': '7',
  };

  for (const field of missingFields) {
    if (fieldToQuestion[field]) {
      return fieldToQuestion[field];
    }
  }
  return '1';
}
```

---

## Преимущества этого подхода:

### ✅ **Соответствие OpenAI Best Practices:**
1. **"Offload burden from the model"** - модель не управляет сложной логикой
2. **"Use code where possible"** - вся логика в коде на сервере
3. **"Keep functions small"** - tools простые и очевидные
4. **"Pass the intern test"** - даже стажёр поймёт, что делает tool

### ✅ **Технические преимущества:**
1. **Низкая latency** - client-side tools отвечают быстро
2. **Меньше токенов** - простые schemas = меньше токенов в context
3. **Легче тестировать** - бизнес-логика на сервере
4. **Безопасность** - sensitive операции (auth, RAG) на сервере
5. **Масштабируемость** - можно кэшировать на сервере

### ✅ **Удобство разработки:**
1. **Разделение ответственности** - tools только для интерфейса
2. **Повторное использование** - API может использоваться из других мест
3. **Легче отлаживать** - server logs vs client logs
4. **TypeScript типы** - можно использовать общие типы между client/server

---

## Сравнение с текущей реализацией:

### ❌ **Текущие проблемы:**

#### Визуальное сравнение архитектур:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ТЕКУЩАЯ АРХИТЕКТУРА                         │
└─────────────────────────────────────────────────────────────────────┘

InterviewAgent (Browser)
├── startInitialInterview         [140 строк логики]
│   └── 7 параллельных RAG запросов для проверки статуса
├── validateInterviewAnswer       [40 строк]
│   └── POST /api/validate-answer
└── conductInitialInterview       [220 строк логики]
    ├── Switch-case для state update
    ├── Логика следующего вопроса
    ├── Формирование summary
    └── POST /api/rag (сохранение)

TOTAL: 3 tools, 400+ строк, 2 API calls на ответ


┌─────────────────────────────────────────────────────────────────────┐
│                      ПРЕДЛАГАЕМАЯ АРХИТЕКТУРА                       │
└─────────────────────────────────────────────────────────────────────┘

InterviewAgent (Browser)
├── startInitialInterview         [~15 строк]
│   └── POST /api/interview?action=start_or_resume
└── saveInterviewAnswer          [~20 строк]
    └── POST /api/interview?action=process_answer
        └── Server-side (автоматически):
            ├── Валидация ответа
            ├── Сохранение в state
            ├── Определение следующего вопроса
            └── Сохранение в RAG (если завершено)

TOTAL: 2 tools, ~35 строк, 1 API call на ответ

📊 Improvement:
   - 3 tools → 2 tools (33% reduction)
   - 400+ строк → 35 строк (91% reduction)
   - 2 API calls → 1 API call (50% latency reduction)
```

---

#### 1. **`conductInitialInterview`** (interviewTools.ts:139-361) - 220+ строк в client-side:
- **Нарушение OpenAI Best Practice**: "Offload burden from the model"
- Switch-case для обновления state (строки 189-211)
- Логика определения следующего вопроса (строки 280-327)
- Формирование summary (строки 228-253)
- Сохранение в RAG через browser fetch (строки 256-260)
- Подсчет прогресса (строки 217-224)
- Вложенный объект `interviewState` без proper strict mode support

#### 2. **`startInitialInterview`** (interviewTools.ts:444-592) - 140+ строк:
- Выполняет 7 параллельных RAG запросов для проверки статуса (строки 483-523)
- Сложная логика определения состояния интервью
- Дублирует логику из `/api/interview` endpoint
- Batch processing с задержками (строки 487-522)

#### 3. **Отсутствие `strict: true`** во всех tools
- Не соответствует рекомендации OpenAI: "We recommend always enabling strict mode"
- Может приводить к неожиданным вызовам с неправильными параметрами

#### 4. **Отсутствие `enum` для ограниченных значений**
- `currentQuestion` и `questionNumber` принимают '1'-'7', но нет enum
- Модель может передать невалидные значения

### ✅ **Предлагаемое решение:**

#### Архитектура:
```
Router Agent (getCurrentUserInfo)
    ↓
Interview Agent (3 простых tools)
    ↓
Server API (/api/interview с actions)
    ↓
RAG/Database
```

#### Разделение ответственности:

| Компонент | Текущее | Предлагаемое |
|-----------|---------|--------------|
| **Количество tools** | 3 tools в interviewAgent | 2 tools (объединены) |
| **Client-side код** | 360+ строк логики | ~35 строк (только API вызовы) |
| **Server-side API** | Только check_status | Полная бизнес-логика |
| **Strict mode** | ❌ Отсутствует | ✅ Везде включен |
| **State management** | ❌ В tool execute | ✅ На сервере (Redis/памяти) |
| **RAG calls** | ❌ Из браузера | ✅ Только с сервера |
| **Tool calls per answer** | 2 calls (validate + conduct) | 1 call (combined) |
| **Валидация ответов** | Отдельный tool | Встроена в saveInterviewAnswer |

#### Преимущества миграции:

1. **Token savings**:
   - Простые schemas экономят ~30% токенов
   - 2 tools вместо 3 = ещё меньше токенов в context

2. **Latency reduction**:
   - Меньше логики в browser = быстрее response
   - 1 tool call вместо 2 (validate + conduct) = **50% меньше latency**

3. **Reliability**:
   - Server-side state management надёжнее
   - Атомарная операция (валидация + сохранение)

4. **Testability**:
   - Можно тестировать API endpoints отдельно
   - Unit tests для валидации логики

5. **Security**:
   - RAG credentials не в браузере
   - Аутентификация на сервере

6. **Simplicity**:
   - Модель использует меньше tools (2 вместо 3)
   - Проще понять flow для developers
   - Меньше кода для поддержки (360+ → ~35 строк)

---

## Пример использования модели:

### Сценарий 1: Успешное прохождение интервью

```
User: "Начни интервью"
Model: *calls startInitialInterview(userId: "123", userPosition: "Developer")*
API Response: {
  status: "started",
  questionId: "1",
  question: "Я вижу, что ваша должность — Developer. Обычно на этой позиции...",
  progress: "0/7"
}
Model: "Отлично! Давайте начнём. Первый вопрос: [question]"

---

User: "Я эксперт в TypeScript, React и системном дизайне"
Model: *calls saveInterviewAnswer(userId: "123", questionId: "1", answer: "...", userPosition: "Developer")*
API Response: {
  status: "in_progress",
  questionId: "2",
  question: "Как мне лучше с вами общаться?...",
  progress: "1/7"
}
Model: "Понятно, учту! Следующий вопрос: [question]"

---

User: "Неформально, сразу к делу"
Model: *calls saveInterviewAnswer(userId: "123", questionId: "2", answer: "...", userPosition: "Developer")*
API Response: {
  status: "in_progress",
  questionId: "3",
  question: "В какие дни недели...",
  progress: "2/7"
}
Model: "Отлично! Буду общаться неформально. Следующий вопрос: [question]"

... (5 вопросов) ...

User: "Сначала сам обдумаю, потом обсуждаю с командой"
Model: *calls saveInterviewAnswer(userId: "123", questionId: "7", answer: "...", userPosition: "Developer")*
API Response: {
  status: "completed",
  message: "Интервью завершено! Ваши предпочтения сохранены."
}
Model: "Спасибо! Интервью завершено. Я буду учитывать ваши предпочтения в работе."
```

### Сценарий 2: Невалидный ответ (автоматическая валидация)

```
User: "да"
Model: *calls saveInterviewAnswer(userId: "123", questionId: "1", answer: "да", userPosition: "Developer")*
API Response: {
  status: "invalid_answer",
  reason: "Ответ слишком короткий и не содержит полезной информации",
  suggestion: "Переформулируйте вопрос, попросив пользователя назвать конкретные области экспертизы",
  retry: true
}
Model: "Хм, ответ получился слишком коротким. Давайте попробуем иначе: в каких конкретных технологиях или областях вы считаете себя экспертом?"

---

User: "TypeScript, React, Node.js и GraphQL"
Model: *calls saveInterviewAnswer(userId: "123", questionId: "1", answer: "...", userPosition: "Developer")*
API Response: {
  status: "in_progress",
  questionId: "2",
  question: "...",
  progress: "1/7"
}
Model: "Отлично! Следующий вопрос..."
```

### Сценарий 3: Возобновление незавершённого интервью

```
User: "Начни интервью"
Model: *calls startInitialInterview(userId: "123", userPosition: "Developer")*
API Response: {
  status: "resume",
  message: "Продолжаем интервью с вопроса 4",
  questionId: "4",
  question: "Когда вам важно работать без отвлечений?",
  progress: "3/7"
}
Model: "Вижу, мы уже начинали интервью! Продолжим с вопроса 4: [question]"
```

### Преимущества нового flow:

**БЫЛО** (2 tool calls на ответ):
```
validateInterviewAnswer → if valid → conductInitialInterview
      (200ms)                             (300ms)
Total: ~500ms + 2x API overhead
```

**СТАЛО** (1 tool call на ответ):
```
saveInterviewAnswer (validation встроена)
         (250ms)
Total: ~250ms + 1x API overhead = **50% faster**
```

---

## План миграции:

### Вариант А: **Минимальный рефакторинг** (быстро, 1-2 часа)

**Цель**: Привести к соответствию с OpenAI best practices без изменения архитектуры

#### Шаги:
1. **Добавить `strict: true`** во все tools:
   - `userInfoTool.ts` → `getCurrentUserInfo`
   - `interviewTools.ts` → все 3 tools

2. **Добавить `enum`** для ограниченных значений:
   - `questionNumber` в `validateInterviewAnswer`
   - `currentQuestion` в `conductInitialInterview`

3. **Упростить `conductInitialInterview`**:
   - Вынести switch-case в helper function
   - Вынести формирование вопросов в constants
   - Убрать вложенный объект `interviewState` или исправить его schema

4. **Оптимизировать `startInitialInterview`**:
   - Убрать 7 параллельных запросов
   - Использовать `/api/interview?action=check_status` вместо прямых RAG вызовов

#### Результат:
- ✅ Соответствие OpenAI best practices
- ✅ Меньше токенов в context
- ❌ Логика всё ещё на client-side
- ❌ Сложность тестирования

---

### Вариант Б: **Правильный рефакторинг** (рекомендуется, 3-4 часа)

**Цель**: Разделить ответственность между client и server

#### Фаза 1: Server-side (1-2 часа)

1. **Расширить `/api/interview/route.ts`**:
   ```typescript
   // Добавить actions:
   - 'start_or_resume'     // Заменит startInitialInterview
   - 'process_answer'      // Заменит conductInitialInterview
   ```

2. **Добавить state management**:
   ```typescript
   // Временное хранилище ответов (in-memory или Redis)
   interface InterviewState {
     userId: string;
     answers: Map<string, string>; // questionId -> answer
     startedAt: Date;
   }
   ```

3. **Переместить helper functions**:
   - `getQuestionText()` - формирование текстов вопросов
   - `getNextQuestionId()` - определение следующего вопроса
   - `buildInterviewSummary()` - формирование summary для RAG

#### Фаза 2: Client-side (1 час)

1. **Упростить `startInitialInterview`**:
   ```typescript
   execute: async (input) => {
     const response = await fetch('/api/interview', {
       method: 'POST',
       body: JSON.stringify({
         action: 'start_or_resume',
         userId: input.userId,
         userPosition: input.userPosition,
       }),
     });
     return await response.json();
   }
   ```

2. **Создать новый `saveInterviewAnswer`**:
   ```typescript
   execute: async (input) => {
     const response = await fetch('/api/interview', {
       method: 'POST',
       body: JSON.stringify({
         action: 'process_answer',
         userId: input.userId,
         questionId: input.questionId,
         answer: input.answer,
       }),
     });
     return await response.json();
   }
   ```

3. **УДАЛИТЬ или DEPRECATED**:
   - `conductInitialInterview` (заменён на `saveInterviewAnswer`)
   - `validateInterviewAnswer` (логика встроена в `saveInterviewAnswer`)

4. **Обновить `interviewAgent.ts`**:
   ```typescript
   // БЫЛО: 3 tools
   tools: [
     getCurrentUserInfo,
     startInitialInterview,        // 140+ строк логики
     conductInitialInterview,      // 220+ строк логики
     validateInterviewAnswer,      // отдельный tool
   ]

   // СТАЛО: 2 простых tools
   tools: [
     startInitialInterview,        // ~15 строк (только API вызов)
     saveInterviewAnswer,          // ~20 строк (API вызов с валидацией)
   ]
   ```

**Упрощение flow**:
```
БЫЛО:
User answer → validateInterviewAnswer → if valid → conductInitialInterview → next question
              (tool call 1)                         (tool call 2)

СТАЛО:
User answer → saveInterviewAnswer → next question (или suggestion если invalid)
              (1 tool call с автоматической валидацией)
```

#### Фаза 3: Testing & Migration (1 час)

1. **Написать тесты** для `/api/interview`:
   - Test `start_or_resume` action
   - Test `process_answer` action
   - Test full interview flow

2. **Обновить prompts**:
   - Обновить `interviewPrompt.ts` с учётом новых tools
   - Объяснить модели новый flow

3. **Протестировать** с реальным пользователем

#### Результат:
- ✅ Полное соответствие OpenAI best practices
- ✅ Минимальное использование токенов
- ✅ Server-side state management
- ✅ Легко тестировать
- ✅ Безопасность (RAG на сервере)
- ✅ Переиспользуемый API

---

### Вариант C: **Постепенная миграция** (рекомендуется для production)

**Цель**: Минимизировать риски, мигрировать поэтапно

#### Этап 1: Подготовка (день 1)
1. Реализовать Вариант А (минимальный рефакторинг)
2. Протестировать на staging
3. Deploy в production

#### Этап 2: Server-side API (день 2-3)
1. Реализовать новые actions в `/api/interview`
2. Написать тесты
3. Deploy, но не использовать

#### Этап 3: Новые tools (день 4)
1. Создать новый файл `interviewTools.v2.ts` с упрощёнными tools
2. Создать feature flag для переключения между v1 и v2
3. Протестировать v2 на staging

#### Этап 4: Migration (день 5)
1. Включить v2 для 10% пользователей
2. Мониторить метрики (latency, errors, user satisfaction)
3. Постепенно увеличить до 100%
4. Удалить v1

---

## Рекомендация:

**Для разработки**: Вариант Б (правильный рефакторинг)
- Чистая архитектура
- Легко поддерживать
- Соответствует best practices

**Для production**: Вариант C (постепенная миграция)
- Минимальные риски
- Можно откатиться
- Данные для сравнения производительности

---

## Чек-лист перед началом:

- [ ] Создать backup текущего кода
- [ ] Документировать текущий flow интервью
- [ ] Написать integration тесты для текущей реализации
- [ ] Определить метрики успеха (latency, completion rate, user satisfaction)
- [ ] Подготовить rollback план

---

## Метрики для мониторинга после миграции:

1. **Performance**:
   - Average latency per tool call
   - Total interview completion time
   - Token usage per interview

2. **Reliability**:
   - Error rate
   - Interview completion rate
   - Tool call failures

3. **User Experience**:
   - User satisfaction score
   - Drop-off rate по вопросам
   - Time to complete interview
