У меня есть тулза  checkInterviewCompleteness которая шлет запросы в раг для получения предпочтений пользователя и опеределния того было ли пройдено интервью или нет

Есть тулза startInitialInterview которая получает статус того пройдено ли интервью {
  "status": "already_completed",
  "message": "ok"
} 

и еще есть тулз  queryUserPreferences

Я хочу объединить это все в 1 тулзу

которая будет проверять статус прохождения интервью, если оно пройдено соответенно она уже может передать необходимый контекст как queryUserPreferences для дальнейшего общения, если интервью пройдено частично должны быть заданы только недостающие вопросы и добавлены в раг, а если интервью не пройдено то его нужно пройти


function call result: manageUserInterview
{
  "interviewStatus": "not_started",
  "completeness": 0,
  "message": "Интервью не проводилось",
  "startMessage": "Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.\n\nПервый вопрос: вы работаете как Специалист. Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.",
  "workspace": "bc2ed03d-e7b4-4f7f-9329-3c2b0cbc2648_user_key_preferences",
  "filledFields": 0,
  "totalFields": 7,
  "missingFields": [
    "компетенции",
    "стиль общения",
    "предпочтения для встреч",
    "фокусная работа",
    "стиль работы",
    "карьерные цели",
    "подход к решению"
  ],
  "nextQuestion": {
    "number": 1,
    "category": "компетенции"
  }
}


MCP Function Call Done: transfer_to_interviewAgent


Agent: interviewAgent
23:30:30.694
MCP Function Call Done: startInitialInterview
{
  "callId": "item_CVO9GPK7pf8cUkerOl3Xz",
  "status": "completed",
  "arguments": "{  \n  \"userId\": \"bc2ed03d-e7b4-4f7f-9329-3c2b0cbc2648\",  \n  \"userPosition\": \"Специалист\" \n}",
  "hasOutput": false,
  "outputPreview": "no output"
}