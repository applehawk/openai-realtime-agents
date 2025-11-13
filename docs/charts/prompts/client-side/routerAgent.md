flowchart TB
  %% --- Сессия / подключение ---
  subgraph Session["Session lifecycle"]
    direction TB
    A["session.created<br>(первое подключение)"] --> B["getCurrentUserInfo(userId)"]
    B --> C["checkInterviewCompleteness(userId)"]
    C --> |not_started| D["Offer interview<br>→ delegate Interview Agent<br>(handoff)"]
    C --> |incomplete| E["Offer to finish interview<br>→ delegate Interview Agent<br>(handoff)"]
    C --> |complete| F["Start working<br>(не упоминать интервью)"]
    %% Important: проверка статуса выполняется только один раз
  end

  %% --- Основной цикл обработки пользовательских запросов ---
  subgraph MainLoop["Обработка запросов от пользователя"]
    direction TB
    G["Получен запрос пользователя"] --> H{Новый пользователь?}
    H -- yes --> I["Path 3: Interview Agent<br>(delegate / handoff)"]
    H -- no --> J{Это web/research / внешний источник?}
    J -- yes --> K["Path 4: Intelligent Supervisor<br>(delegateToIntelligentSupervisor)"]
    J -- no --> L{Вопрос про внутренние документы / история?}
    L -- yes --> M["Path 2: Knowledge Agent<br>(handoff)"]
    L -- no --> N{"Простая одношаговая операция [все параметры ясны]?"}
    N -- yes --> O["Path 1: Direct MCP tools<br>(например read_email, create_event, send_email)"]
    N -- no --> K
  end

  %% --- После возврата от Knowledge Agent ---
  M --> MA["Knowledge Agent: результаты RAG"]
  MA --> |found| MB["Возврат управления к Router<br>дать ответ / продолжить"]
  MA --> |not_found| MC["СРАЗУ → Path 4: Intelligent Supervisor<br>(веб-поиск / research)"]

  %% --- Детали Path 1 (Direct) ---
  subgraph Path1["Path 1 — Direct MCP Tools"]
    direction TB
    O --> P{Тип действия}
    P --> P1["Read (нет подтверждения)"]
    P --> P2["Send email (всегда подтверждать)"]
    P --> P3["Create calendar event (всегда подтверждать)"]
    P2 --> PA["Формат подтверждения:<br>Письмо [кому] с темой «тема». Отправить?"]
    P3 --> PB["Формат подтверждения:<br>Встреча [с кем] [когда] тема «тема». Создать?"]
    P1 --> PC["Простой ответ пользователю:<br>прочитал / показал"]
  end

  %% --- Детали Path 2 (Knowledge Agent) ---
  subgraph Path2["Path 2 — Knowledge Agent"]
    direction TB
    M --> Q1["Handoff → Knowledge Agent<br>(искать в RAG: внутренние документы)"]
    Q1 --> Q2["Knowledge Agent выполняет поиск"]
    Q2 --> MA
  end

  %% --- Детали Path 3 (Interview Agent) ---
  subgraph Path3["Path 3 — Interview Agent"]
    direction TB
    I --> R1["Handoff → Interview Agent<br>(4+3 вопросов)"]
    R1 --> R2["Interview Agent возвращает управление<br>(завершено / частично)"]
    R2 --> MB
  end

  %% --- Детали Path 4 (Intelligent Supervisor) ---
  subgraph Path4["Path 4 — Intelligent Supervisor ⭐"]
    direction TB
    K --> S1["delegateToIntelligentSupervisor(taskDescription, conversationContext, executionMode)"]
    S1 --> S2["Supervisor оценивает сложность<br>(simple / medium / complex)"]
    S2 --> S3{Выбор стратегии}
    S3 --> |Direct| S4["Прямое выполнение (1 шаг)"]
    S3 --> |Flat| S5["Flat workflow (2–7 шагов)"]
    S3 --> |Hierarchical| S6["Hierarchical (>8 шагов)"]
    S4 --> S7["Выполнение и возврат nextResponse + workflowSteps"]
    S5 --> S7
    S6 --> S7
    S7 --> MB
    %% Background progress notifications
    S1 --> SN1["Система может добавлять прогресс:<br>[ШАГ ЗАВЕРШЕН], [ЗАДАЧА ЗАВЕРШЕНА]"]
    SN1 --> SO1["Router сопоставляет Session ID<br>и сообщает пользователю результат<br>(без технических деталей)"]
  end

  %% --- Использование предпочтений ---
  subgraph Prefs["Работа с предпочтениями пользователя"]
    direction TB
    T1["Когда нужно персонализировать (встречи, стиль)?"] --> T2["queryUserPreferences(userId, query)"]
    T2 --> T3["Включить релевантные prefs в conversationContext:<br>Пользователь предпочитает: [...]"]
    T3 --> |Delegation to supervisor| S1
    T3 --> |Direct action| O
    %% Updating prefs
    T4["Обновление prefs через естественную речь?"] --> T5["detectPreferenceUpdateRequest(message)"]
    T5 --> T6{isUpdateRequest?}
    T6 -- true --> T7["updateUserPreferencesTool(userId, userRequest, category, newValue)"]
    T7 --> U1["Подтверждение пользователю:<br>Записал! Теперь буду..."]
    T6 -- false --> U2["Нет обновления"]
  end

  %% --- Decision / Fallback rules (Decision Matrix) ---
  subgraph DecisionMatrix["Decision Matrix / Fallbacks"]
    direction TB
    V1["После Knowledge Agent: если найдено → продолжить; если не найдено → СРАЗУ Supervisor"]
    V2["При сомнении → ВСЕГДА Path 4 (Supervisor)"]
    V3["Проверка интервью выполняется ТОЛЬКО ОДИН РАЗ<br>(при session.created)"]
  end

  %% --- Error handling ---
  subgraph Errors["Error handling"]
    direction TB
    W1["1-й сбой → повторить с другими параметрами<br>Попробую ещё раз"]
    W2["2-й сбой → если сложная задача → delegateToIntelligentSupervisor<br>иначе → Не получается. Попробуем по-другому?"]
    W3["3-й сбой или сбой Supervisor →<br>К сожалению, не могу выполнить. Попробуем другой способ?"]
    W4["Никогда: раскрывать технические детали или бесконечно повторять"]
  end

  %% --- Response style / language control ---
  subgraph Style["Response style & Language control"]
    direction TB
    X1["Только русский язык<br>(включая ошибки языка)"]
    X2["Краткость: подтверждения 3–5 слов; прямые ответы 10–20 слов"]
    X3["Произношение: MCP → эм-си-пи, RAG → раг<br>Даты: пятнадцатое января, пятнадцать ноль-ноль"]
    X4["Неясная речь → Извините, не расслышал. Повторите, пожалуйста?"]
  end

  %% --- Notifications & final reminders ---
  subgraph FinalReminders["Final reminders"]
    direction TB
    Y1["Вы — Router (центр управления) — все запросы к вам"]
    Y2["Всегда возвращать управление пользователю<br>после handoff"]
    Y3["Не упоминать интервью в приветствии, если complete"]
    Y4["Не раскрывать внутренние технические детали (SessionID)"]
  end

  %% --- Внешние связи (возврат в цикл) ---
  F --> G
  MB --> G
  O --> G
  S7 --> G
  U1 --> G

  %% --- Легенда (упрощённо) ---
  subgraph Legend["Легенда"]
    direction LR
    L1["Path1 — Direct MCP tools"]
    L2["Path2 — Knowledge Agent (RAG)"]
    L3["Path3 — Interview Agent"]
    L4["Path4 — Intelligent Supervisor"]
  end
