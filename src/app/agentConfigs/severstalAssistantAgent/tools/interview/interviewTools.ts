import { tool } from '@openai/agents/realtime';
import { callRagApiDirect } from '@/app/lib/ragApiClient';

/**
 * Create user workspace for interview data with fallback handling
 */
export async function createUserWorkspace(userId: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    // Check if workspace exists first
    const workspacesResponse = await callRagApiDirect('/workspaces', 'GET');
    
    // Handle different response structures
    let workspaces = [];
    if (workspacesResponse.workspaces) {
      workspaces = workspacesResponse.workspaces;
    } else if (Array.isArray(workspacesResponse)) {
      workspaces = workspacesResponse;
    } else {
      console.log('[Interview] Unexpected workspaces response structure:', workspacesResponse);
      // Proceed with creation anyway
    }
    
    const existingWorkspace = workspaces.find((ws: any) => ws.name === workspaceName);
    
    if (existingWorkspace) {
      console.log(`[Interview] Workspace ${workspaceName} already exists`);
      return;
    }

    // Create new workspace
    await callRagApiDirect('/workspaces', 'POST', { name: workspaceName });
    console.log(`[Interview] Created workspace: ${workspaceName}`);
  } catch (error: any) {
    console.error(`[Interview] Failed to create workspace:`, error);
    
    // Check if it's a connectivity issue
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[Interview] RAG server appears to be down. Interview data will not be saved.`);
      console.error(`[Interview] Please check if RAG server is running on port 9621`);
      // Don't throw error - allow interview to continue without saving
      return;
    }
    
    throw new Error(`Не удалось создать рабочее пространство: ${error.message}`);
  }
}

/**
 * Save interview data to RAG with fallback handling
 */
export async function saveInterviewData(userId: string, interviewData: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    await callRagApiDirect('/documents/text', 'POST', {
      text: interviewData,
      file_source: 'initial_interview',
      workspace: workspaceName,
    });
    console.log(`[Interview] Saved interview data for user ${userId}`);
  } catch (error: any) {
    console.error(`[Interview] Failed to save interview data:`, error);
    
    // Check if it's a connectivity issue
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      console.error(`[Interview] RAG server appears to be down. Interview data will not be saved.`);
      console.error(`[Interview] Please check if RAG server is running on port 9621`);
      // Don't throw error - allow interview to continue without saving
      return;
    }
    
    throw new Error(`Не удалось сохранить данные интервью: ${error.message}`);
  }
}

/**
 * Tool for conducting initial user interview
 */
export const conductInitialInterview = tool({
  name: 'conductInitialInterview',
  description: `Провести первичное интервью с новым пользователем для настройки персонализированного взаимодействия.
  
Этот инструмент собирает ключевую информацию о предпочтениях, стиле работы и компетенциях пользователя в дружелюбном разговорном формате.
После завершения интервью данные автоматически сохраняются в RAG для дальнейшего использования.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя для создания персонального workspace',
      },
      userPosition: {
        type: 'string',
        description: 'Должность пользователя из базы данных',
      },
      currentQuestion: {
        type: 'string',
        description: 'Текущий вопрос интервью (1-7)',
      },
      userResponse: {
        type: 'string',
        description: 'Ответ пользователя на текущий вопрос',
      },
      interviewState: {
        type: 'object',
        description: 'Состояние интервью с собранными данными',
        properties: {
          competencies: { type: 'string' },
          communicationStyle: { type: 'string' },
          meetingPreferences: { type: 'string' },
          focusTime: { type: 'string' },
          workStyle: { type: 'string' },
          careerGoals: { type: 'string' },
          problemSolvingApproach: { type: 'string' },
        },
      },
    },
    required: ['userId', 'userPosition', 'currentQuestion', 'userResponse', 'interviewState'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, userPosition, currentQuestion, userResponse, interviewState } = input;
    
    console.log(`[Interview] Processing question ${currentQuestion} for user ${userId}`);
    
    // Update interview state with user response
    const updatedState = { ...interviewState };
    
    switch (currentQuestion) {
      case '1':
        updatedState.competencies = userResponse;
        break;
      case '2':
        updatedState.communicationStyle = userResponse;
        break;
      case '3':
        updatedState.meetingPreferences = userResponse;
        break;
      case '4':
        updatedState.focusTime = userResponse;
        break;
      case '5':
        updatedState.workStyle = userResponse;
        break;
      case '6':
        updatedState.careerGoals = userResponse;
        break;
      case '7':
        updatedState.problemSolvingApproach = userResponse;
        break;
    }
    
    // Determine next question or completion
    const questionNumber = parseInt(currentQuestion);
    
    // Check if all required fields are filled (not just question number)
    const allFieldsFilled = 
      updatedState.competencies && updatedState.competencies !== 'заполнено' &&
      updatedState.communicationStyle && updatedState.communicationStyle !== 'заполнено' &&
      updatedState.meetingPreferences && updatedState.meetingPreferences !== 'заполнено' &&
      updatedState.focusTime && updatedState.focusTime !== 'заполнено' &&
      updatedState.workStyle && updatedState.workStyle !== 'заполнено' &&
      updatedState.careerGoals && updatedState.careerGoals !== 'заполнено' &&
      updatedState.problemSolvingApproach && updatedState.problemSolvingApproach !== 'заполнено';
    
    if (allFieldsFilled) {
      // Save interview data to RAG via API
      const interviewSummary = `
ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ: ${userId}
Должность: ${userPosition}
Дата интервью: ${new Date().toISOString()}

КОМПЕТЕНЦИИ И ЭКСПЕРТИЗА:
${updatedState.competencies || 'Не указано'}

СТИЛЬ ОБЩЕНИЯ:
${updatedState.communicationStyle || 'Не указано'}

ПРЕДПОЧТЕНИЯ ДЛЯ ВСТРЕЧ:
${updatedState.meetingPreferences || 'Не указано'}

РЕЖИМ ФОКУСНОЙ РАБОТЫ:
${updatedState.focusTime || 'Не указано'}

СТИЛЬ РАБОТЫ С ЗАДАЧАМИ:
${updatedState.workStyle || 'Не указано'}

КАРЬЕРНЫЕ ЦЕЛИ:
${updatedState.careerGoals || 'Не указано'}

ПОДХОД К РЕШЕНИЮ ЗАДАЧ:
${updatedState.problemSolvingApproach || 'Не указано'}
      `.trim();
      
      try {
        // Create workspace if it doesn't exist
        await createUserWorkspace(userId);
        
        // Save interview data
        await saveInterviewData(userId, interviewSummary);
        
        return {
          status: 'completed',
          message: 'Интервью завершено! Ваши предпочтения сохранены и будут использоваться для персонализации взаимодействия.',
          nextQuestion: null,
          interviewState: updatedState,
        };
      } catch (error: any) {
        console.error('[Interview] Error saving data:', error);
        
        return {
          status: 'error',
          message: `Интервью завершено, но возникла ошибка при сохранении данных: ${error.message}`,
          nextQuestion: null,
          interviewState: updatedState,
        };
      }
    } else {
      // Find next unfilled question
      const questions = [
        {
          id: '1',
          text: `Я вижу, что ваша должность — ${userPosition}. Обычно на этой позиции специалисты разбираются в нескольких ключевых областях. Подтверждаете? Есть ли другие темы, в которых вы эксперт?`,
          field: 'competencies'
        },
        {
          id: '2',
          text: 'Как мне лучше с вами общаться? Предпочитаете официальный деловой тон или более неформальный? Сразу переходить к сути или давать контекст?',
          field: 'communicationStyle'
        },
        {
          id: '3',
          text: 'В какие дни недели и время дня вам удобнее назначать встречи? Например, утро вторника или вторая половина четверга.',
          field: 'meetingPreferences'
        },
        {
          id: '4',
          text: 'Когда вам важно работать без отвлечений? Назовите дни недели и время, когда можно вас беспокоить только в крайнем случае.',
          field: 'focusTime'
        },
        {
          id: '5',
          text: 'Вы предпочитаете сосредоточиться на одной задаче или работать над несколькими проектами параллельно?',
          field: 'workStyle'
        },
        {
          id: '6',
          text: 'Какие у вас профессиональные цели на ближайший год? В чем хотели бы развиваться? Подскажу, если будет профильное обучение или интересные проекты, где можно поучаствовать.',
          field: 'careerGoals'
        },
        {
          id: '7',
          text: 'Когда сталкиваетесь со сложной задачей, вы предпочитаете сначала сами все проработать или обсудить с коллегами?',
          field: 'problemSolvingApproach'
        },
      ];
      
      // Find next unfilled question
      let nextQuestion = null;
      for (const q of questions) {
        const fieldValue = updatedState[q.field as keyof typeof updatedState];
        if (!fieldValue || fieldValue === 'заполнено') {
          nextQuestion = q;
          break;
        }
      }
      
      console.log(`[Interview] Current question: ${currentQuestion}, Next unfilled: ${nextQuestion?.id || 'none'}`);
      
      console.log(`[Interview] Next question found: ${!!nextQuestion}, Text: ${nextQuestion?.text?.substring(0, 50)}`);
      
      if (!nextQuestion) {
        // All questions are filled, interview should be complete
        console.log(`[Interview] All questions filled, interview complete`);
        return {
          status: 'completed',
          message: 'Интервью завершено! Все разделы заполнены.',
          nextQuestion: null,
          interviewState: updatedState,
        };
      }
      
      // Count remaining unfilled questions
      const remainingQuestions = questions.filter(q => {
        const fieldValue = updatedState[q.field as keyof typeof updatedState];
        return !fieldValue || fieldValue === 'заполнено';
      }).length;
      
      return {
        status: 'in_progress',
        message: `СЛЕДУЮЩИЙ ВОПРОС (${nextQuestion.id}/7, осталось ${remainingQuestions}): ${nextQuestion.text}`,
        nextQuestion: nextQuestion.text,
        currentQuestionNumber: parseInt(nextQuestion.id),
        totalQuestions: 7,
        questionsRemaining: remainingQuestions,
        interviewState: updatedState,
        instruction: `ВАЖНО: Задай пользователю nextQuestion. Интервью НЕ ЗАВЕРШЕНО, осталось ${remainingQuestions} вопросов!`,
      };
    }
  },
});

/**
 * Tool for validating interview answers using LLM
 */
export const validateInterviewAnswer = tool({
  name: 'validateInterviewAnswer',
  description: `Валидация качества ответа пользователя на вопрос интервью с помощью LLM.
  
Анализирует ответ пользователя и определяет:
- Качественный ответ (достаточно деталей, релевантен вопросу)
- Некачественный ответ (слишком короткий, нерелевантный, бессмысленный)

При плохом ответе возвращает предложение переформулировать вопрос.`,
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Текст вопроса интервью',
      },
      userAnswer: {
        type: 'string',
        description: 'Ответ пользователя на вопрос',
      },
      questionNumber: {
        type: 'string',
        description: 'Номер вопроса (1-7)',
      },
    },
    required: ['question', 'userAnswer', 'questionNumber'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { question, userAnswer, questionNumber } = input;
    
    console.log(`[Interview] Validating answer for question ${questionNumber}`);
    
    try {
      // Call OpenAI API directly for validation
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Вы эксперт по анализу ответов в интервью. Ваша задача - определить качество ответа пользователя.

ВАЖНО: Будьте МЯГКИМИ в оценке. Пропускайте почти все ответы, кроме явно нерелевантных.

Критерии НЕкачественного ответа (только эти случаи должны возвращать isValid: false):
- Полностью нерелевантный ответ (не по теме вопроса)
- Бессмысленный текст ("ля-ля-ля", "раз два три", "абвгд")
- Очевидно случайные символы или набор букв
- Ответы, которые явно не относятся к вопросу
- Общие фразы - (Не знаю, как обычно, по-разному)

Критерии качественного ответа (все остальные случаи):
- Любой осмысленный ответ, даже короткий
- Ответы типа "да", "нет" - принимайте как валидные
- Короткие ответы - принимайте как валидные
- Любой ответ, который хоть как-то связан с вопросом

Верните JSON:
{
  "isValid": true/false,
  "reason": "краткое объяснение",
  "suggestion": "предложение для переформулировки вопроса (если isValid = false)"
}`
            },
            {
              role: 'user',
              content: `Вопрос ${questionNumber}: ${question}

Ответ пользователя: ${userAnswer}

Проанализируйте качество ответа.`
            }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Interview] OpenAI API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const validationResult = JSON.parse(data.choices[0].message.content);

      console.log(`[Interview] Validation result for question ${questionNumber}:`, validationResult);

      return {
        isValid: validationResult.isValid,
        reason: validationResult.reason,
        suggestion: validationResult.suggestion || null,
        questionNumber,
        userAnswer,
      };
    } catch (error: any) {
      console.error('[Interview] Error validating answer:', error);
      // Fallback: consider answer valid if validation fails
      return {
        isValid: true,
        reason: 'Ошибка валидации, считаем ответ валидным',
        suggestion: null,
        questionNumber,
        userAnswer,
      };
    }
  },
});

/**
 * Simple tool to start initial interview
 */
export const startInitialInterview = tool({
  name: 'startInitialInterview',
  description: 'Начать или продолжить интервью с пользователем для сбора предпочтений',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      userPosition: {
        type: 'string',
        description: 'Должность пользователя',
      },
    },
    required: ['userId', 'userPosition'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, userPosition } = input;
    
    // Check if interview already exists and determine completion status
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      // Define required fields with their question numbers
      const requiredFields = [
        { key: 'компетенции', questionNumber: 1, patterns: ['компетенци', 'эксперт', 'навык'] },
        { key: 'стиль общения', questionNumber: 2, patterns: ['стиль', 'общени', 'коммуникац'] },
        { key: 'предпочтения для встреч', questionNumber: 3, patterns: ['встреч', 'предпочтен', 'время'] },
        { key: 'фокусная работа', questionNumber: 4, patterns: ['фокус', 'концентрац', 'отвлечен'] },
        { key: 'стиль работы', questionNumber: 5, patterns: ['работ', 'задач', 'проект'] },
        { key: 'карьерные цели', questionNumber: 6, patterns: ['карьер', 'цел', 'развит'] },
        { key: 'подход к решению', questionNumber: 7, patterns: ['подход', 'решен', 'задач'] },
      ];
      
      const response = await callRagApiDirect('/query', 'POST', {
        query: `полный профиль пользователя ${userId} со всеми разделами: компетенции, стиль общения, предпочтения для встреч, фокусная работа, стиль работы, карьерные цели, подход к решению задач`,
        mode: 'local',
        top_k: 5,
        workspace: workspaceName,
      });
      
      if (response && response.response && 
          !response.response.includes('не располагаю достаточной информацией') &&
          !response.response.includes('No relevant context found') &&
          !response.response.includes('не найдено')) {
        
        // Check which fields are present
        const responseText = response.response.toLowerCase();
        const filledFields = [];
        const missingFields = [];
        
        for (const field of requiredFields) {
          const isPresent = field.patterns.some(pattern => responseText.includes(pattern));
          if (isPresent) {
            filledFields.push(field);
          } else {
            missingFields.push(field);
          }
        }
        
        console.log(`[Interview] startInitialInterview check for user ${userId}`);
        console.log(`[Interview] Filled fields: ${filledFields.length}, Missing: ${missingFields.length}`);
        
        if (missingFields.length === 0) {
          // Interview is complete
          console.log(`[Interview] ✅ Interview already complete for user ${userId}`);
          return {
            status: 'already_completed',
            message: 'ok', // Интервью уже пройдено полностью - молча продолжаем работу
          };
        } else {
          // Interview is incomplete - determine starting point
          const nextQuestionNumber = Math.min(...missingFields.map(f => f.questionNumber));
          const nextField = missingFields.find(f => f.questionNumber === nextQuestionNumber);
          
          console.log(`[Interview] ❌ Incomplete interview for user ${userId}. Starting from question ${nextQuestionNumber}`);
          
          return {
            status: 'resume',
            message: `Продолжаем интервью с вопроса ${nextQuestionNumber}. Уже заполнено ${filledFields.length} из 7 разделов.`,
            currentQuestion: nextQuestionNumber.toString(),
            filledFields: filledFields.map(f => f.key),
            missingFields: missingFields.map(f => f.key),
            interviewState: {
              competencies: filledFields.find(f => f.key === 'компетенции') ? 'заполнено' : '',
              communicationStyle: filledFields.find(f => f.key === 'стиль общения') ? 'заполнено' : '',
              meetingPreferences: filledFields.find(f => f.key === 'предпочтения для встреч') ? 'заполнено' : '',
              focusTime: filledFields.find(f => f.key === 'фокусная работа') ? 'заполнено' : '',
              workStyle: filledFields.find(f => f.key === 'стиль работы') ? 'заполнено' : '',
              careerGoals: filledFields.find(f => f.key === 'карьерные цели') ? 'заполнено' : '',
              problemSolvingApproach: filledFields.find(f => f.key === 'подход к решению') ? 'заполнено' : '',
            },
          };
        }
      }
    } catch (error) {
      console.log('[Interview] Could not check status, proceeding with new interview');
    }
    
    // Start first question
    const firstQuestion = `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.

Первый вопрос: вы работаете как ${userPosition}. Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.`;
    
    return {
      status: 'started',
      message: firstQuestion,
      currentQuestion: '1',
      interviewState: {
        competencies: '',
        communicationStyle: '',
        meetingPreferences: '',
        focusTime: '',
        workStyle: '',
        careerGoals: '',
        problemSolvingApproach: '',
      },
    };
  },
});