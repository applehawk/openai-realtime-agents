import { tool } from '@openai/agents/realtime';

// Use API proxy endpoint for client-side execution
const RAG_API_PROXY = '/api/rag';

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy
 */
async function callRagServer(toolName: string, args: any) {
  try {
    console.log(`[Interview] Calling ${toolName} with args:`, args);

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`RAG server returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RAG server error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    console.log(`[Interview] ${toolName} completed successfully`);

    // Extract text content from MCP response format
    if (data.result?.content?.[0]?.text) {
      return data.result.content[0].text;
    }

    return JSON.stringify(data.result || data);
  } catch (error: any) {
    console.error(`[Interview] Error calling ${toolName}:`, error);
    throw new Error(`Ошибка подключения к базе знаний: ${error.message}`);
  }
}

/**
 * Create user workspace for interview data
 */
export async function createUserWorkspace(userId: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    // For now, we'll assume workspace creation is handled by the RAG server
    // when we make the first query. This simplifies the process and avoids
    // direct API calls that might fail.
    console.log(`[Interview] Workspace ${workspaceName} will be created on first use`);
  } catch (error: any) {
    console.error(`[Interview] Failed to prepare workspace:`, error);
    throw new Error(`Не удалось подготовить рабочее пространство: ${error.message}`);
  }
}

/**
 * Save interview data to RAG
 */
export async function saveInterviewData(userId: string, interviewData: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    // Use RAG MCP server to save interview data
    await callRagServer('lightrag_add_documents', {
      documents: [{
        content: interviewData,
        metadata: {
          source: 'initial_interview',
          userId: userId,
          timestamp: new Date().toISOString(),
        }
      }],
      workspace: workspaceName,
    });
    
    console.log(`[Interview] Saved interview data for user ${userId}`);
  } catch (error: any) {
    console.error(`[Interview] Failed to save interview data:`, error);
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
      try {
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
        
        // Save interview data directly to RAG
        const workspaceName = `${userId}_user_key_preferences`;
        
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
 * Tool for validating interview answers using backend API
 */
export const validateInterviewAnswer = tool({
  name: 'validateInterviewAnswer',
  description: `Валидация качества ответа пользователя на вопрос интервью через бекенд API.
  
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
    
    console.log(`[Interview] Validating answer for question ${questionNumber} via backend API`);
    
    try {
      // Call backend API for validation instead of direct OpenAI call
      const response = await fetch('/api/validate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          userAnswer,
          questionNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const validationResult = await response.json();
      console.log(`[Interview] Backend validation result for question ${questionNumber}:`, validationResult);

      return {
        isValid: validationResult.isValid,
        reason: validationResult.reason,
        suggestion: validationResult.suggestion || null,
        questionNumber,
        userAnswer,
      };
    } catch (error: any) {
      console.error('[Interview] Error validating answer via backend:', error);
      // Fallback: consider answer valid if validation fails
      return {
        isValid: true,
        reason: 'Ошибка валидации через бекенд, считаем ответ валидным',
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
      
      // Define the 7 required preference categories with question numbers
      const preferenceCategories = [
        { key: 'компетенции', questionNumber: 1 },
        { key: 'стиль общения', questionNumber: 2 },
        { key: 'предпочтения для встреч', questionNumber: 3 },
        { key: 'фокусная работа', questionNumber: 4 },
        { key: 'стиль работы', questionNumber: 5 },
        { key: 'карьерные цели', questionNumber: 6 },
        { key: 'подход к решению', questionNumber: 7 },
      ];
      
      const filledFields = [];
      const missingFields = [];
      
      // Check preference categories with controlled concurrency to avoid RAG server conflicts
      const results = [];
      const batchSize = 3; // Process 3 categories at a time
      
      for (let i = 0; i < preferenceCategories.length; i += batchSize) {
        const batch = preferenceCategories.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (category) => {
          try {
            const categoryResponse = await callRagServer('lightrag_query', {
              query: `${category.key} пользователя ${userId}`,
              mode: 'local',
              top_k: 1,
              workspace: workspaceName,
            });
            
            // Check if we got meaningful data for this category
            if (categoryResponse && 
                !categoryResponse.includes('не располагаю достаточной информацией') &&
                !categoryResponse.includes('не найдено') &&
                categoryResponse.length > 20) {
              console.log(`[Interview] ✅ Found data for ${category.key}: ${categoryResponse.length} chars`);
              return { category, found: true };
            } else {
              console.log(`[Interview] ❌ No data for ${category.key}`);
              return { category, found: false };
            }
          } catch (error) {
            console.log(`[Interview] Error checking ${category.key}:`, error);
            return { category, found: false };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to prevent server overload
        if (i + batchSize < preferenceCategories.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Process results
      for (const result of results) {
        if (result.found) {
          filledFields.push(result.category);
        } else {
          missingFields.push(result.category);
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