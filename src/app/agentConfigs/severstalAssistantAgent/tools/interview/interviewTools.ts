import { tool } from '@openai/agents/realtime';

// Use API proxy endpoint for client-side execution
const RAG_API_PROXY = '/api/rag';

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy (for server-side execution)
 */
async function callRagServerForPreferences(query: string, workspace: string) {
  try {
    console.log(`[ManageUserInterview] Querying workspace: ${workspace}`);
    console.log(`[ManageUserInterview] Query: ${query}`);

    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'lightrag_query',
        arguments: {
          query,
          mode: 'local',
          top_k: 3,
          workspace,
          include_references: true,
        },
      },
    };

    console.log(`[ManageUserInterview] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`RAG server returned status ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`[ManageUserInterview] Response received:`, {
      hasResult: !!data.result,
      hasError: !!data.error,
      contentLength: data.result?.content?.[0]?.text?.length,
    });

    if (data.error) {
      console.error(`[ManageUserInterview] RAG server error:`, data.error);
      throw new Error(`RAG server error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Extract text content from MCP response format
    if (data.result?.content?.[0]?.text) {
      const result = data.result.content[0].text;
      console.log(`[ManageUserInterview] Extracted text (first 200 chars):`, result.substring(0, 200));
      return result;
    }

    const fallbackResult = JSON.stringify(data.result || data);
    console.log(`[ManageUserInterview] Fallback result:`, fallbackResult.substring(0, 200));
    return fallbackResult;
  } catch (error: any) {
    console.error(`[ManageUserInterview] Error calling RAG server:`, error);
    throw new Error(`Ошибка подключения к базе знаний: ${error.message}`);
  }
}

/**
 * Helper function to call RAG MCP server via JSON-RPC through API proxy (for client-side execution)
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
 * Helper function to call RAG REST API via proxy
 * This is for client-side (browser) execution in realtime tools
 */
async function callRagApi(endpoint: string, method: string, data?: any) {
  try {
    console.log(`[RAG REST] Calling ${method} ${endpoint}`, data ? { dataKeys: Object.keys(data) } : {});

    const response = await fetch(RAG_API_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint, method, data }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`[RAG REST] Success:`, { endpoint, hasData: !!result });
    return result;
  } catch (error: any) {
    console.error(`[RAG REST] Error:`, error);
    throw new Error(`RAG API connection failed: ${error.message}`);
  }
}

/**
 * Create user workspace for interview data with fallback handling
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
 * Save interview data to RAG with fallback handling
 */
export async function saveInterviewData(userId: string, interviewData: string): Promise<void> {
  const workspaceName = `${userId}_user_key_preferences`;
  
  try {
    // Use RAG REST API proxy to save interview data
    const response = await fetch('/api/rag-rest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: '/documents/text',
        method: 'POST',
        data: {
          text: interviewData,
          file_source: 'initial_interview',
          workspace: workspaceName,
        }
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`RAG API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`[Interview] Saved interview data for user ${userId}:`, result);
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
      // Call backend API for validation
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
 * Unified tool for managing user interview and preferences
 * Combines functionality of checkInterviewCompleteness, startInitialInterview, and queryUserPreferences
 */
export const manageUserInterview = tool({
  name: 'manageUserInterview',
  description: `Универсальный инструмент для управления интервью пользователя и получения предпочтений.
  
Объединяет функциональность проверки статуса интервью, получения предпочтений и инициации интервью.

Логика работы:
- Если интервью пройдено полностью (100%) → возвращает все предпочтения пользователя
- Если интервью пройдено частично (1-99%) → возвращает частичные предпочтения + недостающие вопросы
- Если интервью не пройдено (0%) → возвращает приглашение начать интервью

Используется Router Agent для принятия решений о персонализации и необходимости интервью.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      userPosition: {
        type: 'string',
        description: 'Должность пользователя (опционально, для новых интервью)',
      },
    },
    required: ['userId'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, userPosition } = input;
    
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      // Define the 7 required preference categories
      const preferenceCategories = [
        { key: 'компетенции', questionNumber: 1 },
        { key: 'стиль общения', questionNumber: 2 },
        { key: 'предпочтения для встреч', questionNumber: 3 },
        { key: 'фокусная работа', questionNumber: 4 },
        { key: 'стиль работы', questionNumber: 5 },
        { key: 'карьерные цели', questionNumber: 6 },
        { key: 'подход к решению', questionNumber: 7 },
      ];
      
      // Check if profile exists and get full profile for debugging
      const fullProfileResult = await callRagServerForPreferences(
        `полный профиль пользователя ${userId} со всеми разделами: компетенции, стиль общения, предпочтения для встреч, фокусная работа, стиль работы, карьерные цели, подход к решению задач`,
        workspaceName
      );
      
      // Check if profile exists and is meaningful
      if (!fullProfileResult || fullProfileResult.includes('не располагаю достаточной информацией') || 
          fullProfileResult.includes('No relevant context found') || fullProfileResult.includes('не найдено')) {
        
        // No interview conducted
        const startMessage = userPosition 
          ? `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.

Первый вопрос: вы работаете как ${userPosition}. Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.`
          : `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.

Первый вопрос: Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.`;
        
        return {
          interviewStatus: 'not_started',
          completeness: 0,
          message: 'Интервью не проводилось',
          startMessage,
          workspace: workspaceName,
          filledFields: 0,
          totalFields: preferenceCategories.length,
          missingFields: preferenceCategories.map(c => c.key),
          nextQuestion: {
            number: 1,
            category: 'компетенции'
          }
        };
      }
      
      console.log(`[ManageUserInterview] Debug - Full profile for user ${userId}:`);
      console.log(`[ManageUserInterview] Profile length: ${fullProfileResult.length} chars`);
      
      // Check each category individually
      const filledFields = [];
      const missingFields = [];
      const preferences: any = {};
      
      // Check preference categories sequentially with 50ms delay between requests
      for (let i = 0; i < preferenceCategories.length; i++) {
        const category = preferenceCategories[i];
        
        try {
          console.log(`[ManageUserInterview] Checking ${category.key} (${i + 1}/${preferenceCategories.length})`);
          
          const categoryResponse = await callRagServerForPreferences(
            `${category.key} пользователя ${userId}`,
            workspaceName
          );
          
          // Check if we got meaningful data for this category
          if (categoryResponse && 
              !categoryResponse.includes('не располагаю достаточной информацией') &&
              !categoryResponse.includes('No relevant context found') &&
              !categoryResponse.includes('не найдено') &&
              categoryResponse.length > 20) {
            console.log(`[ManageUserInterview] ✅ Found data for ${category.key}: ${categoryResponse.length} chars`);
            filledFields.push(category);
            
            // Map category to preferences object
            switch (category.key) {
              case 'компетенции':
                preferences.competencies = categoryResponse;
                break;
              case 'стиль общения':
                preferences.communicationStyle = categoryResponse;
                break;
              case 'предпочтения для встреч':
                preferences.meetingPreferences = categoryResponse;
                break;
              case 'фокусная работа':
                preferences.focusTime = categoryResponse;
                break;
              case 'стиль работы':
                preferences.workStyle = categoryResponse;
                break;
              case 'карьерные цели':
                preferences.careerGoals = categoryResponse;
                break;
              case 'подход к решению':
                preferences.problemSolvingApproach = categoryResponse;
                break;
            }
          } else {
            console.log(`[ManageUserInterview] ❌ No data for ${category.key}`);
            missingFields.push(category);
          }
        } catch (error) {
          console.log(`[ManageUserInterview] Error checking ${category.key}:`, error);
          missingFields.push(category);
        }
        
        // 50ms delay between requests to prevent server overload
        if (i < preferenceCategories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Fallback: if at least half (4/7) categories were found, retry the missing ones
      if (filledFields.length >= 4 && missingFields.length > 0) {
        console.log(`[ManageUserInterview] Fallback: Found ${filledFields.length}/7 categories, retrying ${missingFields.length} missing ones`);
        
        for (const category of missingFields) {
          try {
            console.log(`[ManageUserInterview] Retry checking ${category.key}`);
            
            const retryResponse = await callRagServerForPreferences(
              `${category.key} пользователя ${userId}`,
              workspaceName
            );
            
            // Check if retry was successful
            if (retryResponse && 
                !retryResponse.includes('не располагаю достаточной информацией') &&
                !retryResponse.includes('No relevant context found') &&
                !retryResponse.includes('не найдено') &&
                retryResponse.length > 20) {
              console.log(`[ManageUserInterview] ✅ Retry successful for ${category.key}: ${retryResponse.length} chars`);
              filledFields.push(category);
              
              // Map category to preferences object
              switch (category.key) {
                case 'компетенции':
                  preferences.competencies = retryResponse;
                  break;
                case 'стиль общения':
                  preferences.communicationStyle = retryResponse;
                  break;
                case 'предпочтения для встреч':
                  preferences.meetingPreferences = retryResponse;
                  break;
                case 'фокусная работа':
                  preferences.focusTime = retryResponse;
                  break;
                case 'стиль работы':
                  preferences.workStyle = retryResponse;
                  break;
                case 'карьерные цели':
                  preferences.careerGoals = retryResponse;
                  break;
                case 'подход к решению':
                  preferences.problemSolvingApproach = retryResponse;
                  break;
              }
              
              // Remove from missing fields
              const index = missingFields.findIndex(field => field.key === category.key);
              if (index > -1) {
                missingFields.splice(index, 1);
              }
            } else {
              console.log(`[ManageUserInterview] ❌ Retry failed for ${category.key}`);
            }
          } catch (error) {
            console.log(`[ManageUserInterview] Error retrying ${category.key}:`, error);
          }
          
          // 50ms delay between retry requests
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      const completeness = Math.round((filledFields.length / preferenceCategories.length) * 100);
      
      console.log(`[ManageUserInterview] Final status for user ${userId}:`);
      console.log(`[ManageUserInterview] Filled fields: ${filledFields.length}, Missing: ${missingFields.length}, Completeness: ${completeness}%`);
      
      // Determine status and return appropriate response
      if (completeness === 100) {
        // Interview is complete - return all preferences
        return {
          interviewStatus: 'complete',
          completeness,
          message: 'Профиль полный - все предпочтения доступны',
          preferences,
          workspace: workspaceName,
          filledFields: filledFields.length,
          totalFields: preferenceCategories.length,
        };
      } else if (completeness > 0) {
        // Interview is incomplete - return partial preferences and missing fields
        const nextQuestionNumber = Math.min(...missingFields.map(f => f.questionNumber));
        const nextField = missingFields.find(f => f.questionNumber === nextQuestionNumber);
        
        return {
          interviewStatus: 'incomplete',
          completeness,
          message: `Профиль неполный (${completeness}%) - доступны частичные предпочтения`,
          preferences,
          missingFields: missingFields.map(f => f.key),
          nextQuestion: nextField ? {
            number: nextField.questionNumber,
            category: nextField.key
          } : undefined,
          workspace: workspaceName,
          filledFields: filledFields.length,
          totalFields: preferenceCategories.length,
        };
      } else {
        // No meaningful data found despite initial check
        const startMessage = userPosition 
          ? `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.

Первый вопрос: вы работаете как ${userPosition}. Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.`
          : `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего несколько минут.

Первый вопрос: Расскажите, в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи.`;
        
        return {
          interviewStatus: 'not_started',
          completeness: 0,
          message: 'Интервью не проводилось',
          startMessage,
          workspace: workspaceName,
          filledFields: 0,
          totalFields: preferenceCategories.length,
          missingFields: preferenceCategories.map(c => c.key),
          nextQuestion: {
            number: 1,
            category: 'компетенции'
          }
        };
      }
    } catch (error: any) {
      console.error('[ManageUserInterview] Error managing interview:', error);
      return {
        interviewStatus: 'error',
        completeness: 0,
        message: `Ошибка при проверке статуса интервью: ${error.message}`,
        workspace: `${userId}_user_key_preferences`,
        filledFields: 0,
        totalFields: 7,
      };
    }
  },
});