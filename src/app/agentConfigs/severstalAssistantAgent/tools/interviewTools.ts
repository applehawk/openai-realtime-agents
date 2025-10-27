import { tool } from '@openai/agents/realtime';

// RAG API configuration
const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://79.132.139.57:8000/mcp'; // MCP endpoint
const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621'; // Direct API endpoint
const RAG_API_TIMEOUT = parseInt(process.env.RAG_API_TIMEOUT || '30000');
const RAG_API_RETRY_ATTEMPTS = parseInt(process.env.RAG_API_RETRY_ATTEMPTS || '3');

/**
 * Helper function to call RAG API directly (server-side)
 * This function will be used by server-side API endpoints
 */
export async function callRagApiDirect(endpoint: string, method: string, data?: any) {
  try {
    const url = `${RAG_API_BASE_URL}${endpoint}`;
    console.log(`[RAG API] Calling ${method} ${url}`, data ? { dataKeys: Object.keys(data) } : {});

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(RAG_API_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RAG API] Error ${response.status}:`, errorText);
      throw new Error(`RAG API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[RAG API] Success:`, { endpoint, hasData: !!result });
    return result;
  } catch (error: any) {
    console.error(`[RAG API] Network error:`, error);
    throw new Error(`RAG API connection failed: ${error.message}`);
  }
}

/**
 * Create user workspace for interview data
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
    throw new Error(`Не удалось создать рабочее пространство: ${error.message}`);
  }
}

/**
 * Save interview data to RAG
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
    const isComplete = questionNumber >= 7; // ALL questions are required
    
    if (isComplete) {
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
      // Continue with next question
      const nextQuestionNumber = questionNumber + 1;
      
      console.log(`[Interview] Current question: ${currentQuestion}, Next: ${nextQuestionNumber}`);
      
      const questions = [
        {
          id: '1',
          text: `Я вижу, что ваша должность — ${userPosition}. Обычно на этой позиции специалисты разбираются в нескольких ключевых областях. Подтверждаете? Есть ли другие темы, в которых вы эксперт?`,
        },
        {
          id: '2',
          text: 'Как мне лучше с вами общаться? Предпочитаете официальный деловой тон или более неформальный? Сразу переходить к сути или давать контекст?',
        },
        {
          id: '3',
          text: 'В какие дни недели и время дня вам удобнее назначать встречи? Например, утро вторника или вторая половина четверга.',
        },
        {
          id: '4',
          text: 'Когда вам важно работать без отвлечений? Назовите дни недели и время, когда можно вас беспокоить только в крайнем случае.',
        },
        {
          id: '5',
          text: 'Вы предпочитаете сосредоточиться на одной задаче или работать над несколькими проектами параллельно?',
        },
        {
          id: '6',
          text: 'Какие у вас профессиональные цели на ближайший год? В чем хотели бы развиваться? Подскажу, если будет профильное обучение или интересные проекты, где можно поучаствовать.',
        },
        {
          id: '7',
          text: 'Когда сталкиваетесь со сложной задачей, вы предпочитаете сначала сами все проработать или обсудить с коллегами?',
        },
      ];
      
      const nextQuestion = questions.find(q => q.id === nextQuestionNumber.toString());
      
      console.log(`[Interview] Next question found: ${!!nextQuestion}, Text: ${nextQuestion?.text?.substring(0, 50)}`);
      
      if (!nextQuestion) {
        console.error(`[Interview] ERROR: Question ${nextQuestionNumber} not found! This should never happen!`);
      }
      
      const remainingQuestions = 7 - nextQuestionNumber + 1;
      
      return {
        status: 'in_progress',
        message: `СЛЕДУЮЩИЙ ВОПРОС (${nextQuestionNumber}/7, осталось ${remainingQuestions}): ${nextQuestion?.text || `ОШИБКА: вопрос ${nextQuestionNumber} не найден`}`,
        nextQuestion: nextQuestion?.text || null,
        currentQuestionNumber: nextQuestionNumber,
        totalQuestions: 7,
        questionsRemaining: remainingQuestions,
        interviewState: updatedState,
        instruction: `ВАЖНО: Задай пользователю nextQuestion. Интервью НЕ ЗАВЕРШЕНО, осталось ${remainingQuestions} вопросов!`,
      };
    }
  },
});

/**
 * Simple tool to start initial interview
 */
export const startInitialInterview = tool({
  name: 'startInitialInterview',
  description: 'Начать первичное интервью с пользователем для сбора предпочтений',
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
    
    // Check if interview already exists AND is complete by querying RAG directly
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      // Check all required fields
      const requiredFields = [
        'компетенции',
        'стиль общения',
        'предпочтения для встреч',
        'фокусная работа',
        'стиль работы',
        'карьерные цели',
        'подход к решению задач'
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
        
        // Check if ALL required fields are present
        const responseText = response.response.toLowerCase();
        const missingFields = requiredFields.filter(field => 
          !responseText.includes(field.toLowerCase())
        );
        
        const notSpecifiedCount = (responseText.match(/не указано/gi) || []).length;
        const minProfileLength = 300;
        const isLongEnough = response.response.length >= minProfileLength;
        
        console.log(`[Interview] startInitialInterview check for user ${userId}`);
        console.log(`[Interview] Missing fields: ${missingFields.length}, NotSpecified: ${notSpecifiedCount}, Length: ${response.response.length}`);
        
        if (missingFields.length === 0 && notSpecifiedCount < requiredFields.length && isLongEnough) {
          // Interview is complete with all fields
          console.log(`[Interview] ✅ Interview already complete for user ${userId}`);
          return {
            status: 'already_completed',
            message: 'ok', // Интервью уже пройдено полностью - молча продолжаем работу
          };
        } else {
          // Interview exists but incomplete - continue from where we left off
          console.log(`[Interview] ❌ Incomplete interview for user ${userId}. Will complete missing fields.`);
        }
      }
    } catch (error) {
      console.log('[Interview] Could not check status, proceeding with interview');
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

/**
 * Tool for checking if user has completed initial interview with ALL fields filled
 * DEPRECATED: Use queryUserPreferences instead
 */
const _deprecatedCheckInterviewStatus = tool({
  name: '_deprecated_checkInterviewStatus',
  description: 'DEPRECATED: Use queryUserPreferences instead',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
    },
    required: ['userId'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId } = input;
    
    try {
      // Проверяем наличие данных интервью в workspace пользователя
      const workspaceName = `${userId}_user_key_preferences`;
      
      console.log(`\n========================================`);
      console.log(`[Interview] Checking interview status for user: ${userId}`);
      console.log(`[Interview] Workspace: ${workspaceName}`);
      console.log(`========================================\n`);
      
      // Запрашиваем ПОЛНЫЙ профиль пользователя через API proxy (работает на клиенте)
      const ragResponse = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'lightrag_query',
            arguments: {
              query: `покажи весь профиль пользователя ${userId} включая все разделы: компетенции, стиль общения, предпочтения встреч, фокусную работу, стиль работы, карьерные цели, подход к решению задач`,
              mode: 'local',
              top_k: 10,
              workspace: workspaceName,
              include_references: true,
            },
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      
      if (!ragResponse.ok) {
        console.error(`[Interview] RAG API returned status ${ragResponse.status}`);
        return {
          hasInterview: false,
          message: 'Не удалось проверить статус интервью. Попробуйте позже.',
        };
      }
      
      const ragData = await ragResponse.json();
      
      if (ragData.error) {
        console.error(`[Interview] RAG API error:`, ragData.error);
        return {
          hasInterview: false,
          message: 'Ошибка при проверке статуса интервью.',
        };
      }
      
      // Extract response text from MCP format
      let responseText = '';
      if (ragData.result?.content?.[0]?.text) {
        // Try to parse if it's JSON
        try {
          const parsed = JSON.parse(ragData.result.content[0].text);
          responseText = parsed.response || ragData.result.content[0].text;
        } catch {
          responseText = ragData.result.content[0].text;
        }
      } else {
        responseText = JSON.stringify(ragData.result || ragData);
      }
      
      const response = { response: responseText };
      
      console.log(`[Interview] RAG Response received:`);
      console.log(`[Interview] Response exists: ${!!response}`);
      console.log(`[Interview] Response.response exists: ${!!response?.response}`);
      
      if (response && response.response) {
        console.log(`\n========================================`);
        console.log(`[Interview] FULL PROFILE CONTENT:`);
        console.log(`========================================`);
        console.log(response.response);
        console.log(`========================================`);
        console.log(`[Interview] Profile length: ${response.response.length} characters\n`);
        
        // Проверяем на признаки отсутствия данных
        const hasNoData = 
          response.response.includes('не располагаю достаточной информацией') ||
          response.response.includes('No relevant context found') ||
          response.response.includes('не найдено');
        
        if (hasNoData) {
          console.log(`[Interview] ❌ RAG returned "no data" response`);
          return {
            hasInterview: false,
            message: 'Интервью не проводилось. Требуется делегировать Interview Agent.',
          };
        }
        
        // Проверяем каждое обязательное поле
        const responseText = response.response.toLowerCase();
        const fieldChecks = {
          'компетенции': responseText.includes('компетенци'),
          'стиль общения': responseText.includes('стиль') && responseText.includes('общени'),
          'предпочтения для встреч': responseText.includes('встреч') || responseText.includes('предпочтен'),
          'фокусная работа': responseText.includes('фокус'),
          'стиль работы': responseText.includes('работ'),
          'карьерные цели': responseText.includes('карьер') || responseText.includes('цел'),
          'подход к решению': responseText.includes('подход') || responseText.includes('решен'),
        };
        
        console.log(`[Interview] Field presence check:`);
        Object.entries(fieldChecks).forEach(([field, present]) => {
          console.log(`  ${present ? '✅' : '❌'} ${field}: ${present ? 'FOUND' : 'MISSING'}`);
        });
        
        const missingFields = Object.entries(fieldChecks)
          .filter(([_, present]) => !present)
          .map(([field, _]) => field);
        
        const notSpecifiedCount = (response.response.match(/не указано/gi) || []).length;
        const minProfileLength = 300;
        const isLongEnough = response.response.length >= minProfileLength;
        
        console.log(`\n[Interview] Completeness check:`);
        console.log(`  Missing fields: ${missingFields.length} - [${missingFields.join(', ')}]`);
        console.log(`  "Не указано" count: ${notSpecifiedCount}/7`);
        console.log(`  Length: ${response.response.length} >= ${minProfileLength} = ${isLongEnough ? '✅' : '❌'}`);
        
        const isComplete = missingFields.length === 0 && notSpecifiedCount < 7 && isLongEnough;
        
        // Создаём детальный отчёт для отладки
        const debugInfo = {
          profileLength: response.response.length,
          missingFieldsCount: missingFields.length,
          missingFieldsList: missingFields,
          notSpecifiedCount: notSpecifiedCount,
          isLongEnough: isLongEnough,
          profilePreview: response.response.substring(0, 200) + '...',
        };
        
        console.log(`\n[Interview] Debug info:`, JSON.stringify(debugInfo, null, 2));
        
        if (isComplete) {
          console.log(`\n[Interview] ✅✅✅ INTERVIEW COMPLETE ✅✅✅\n`);
          
          // Parse structured data from profile
          const profileText = response.response;
          const extractField = (fieldName: string): string => {
            const regex = new RegExp(`${fieldName}[:\\s]+(.*?)(?=\\n[А-ЯЁ]+:|$)`, 'is');
            const match = profileText.match(regex);
            return match ? match[1].trim() : 'Не указано';
          };
          
          const result = {
            hasInterview: true,
            message: 'ok',
            profile: {
              userId: userId,
              competencies: extractField('КОМПЕТЕНЦИИ И ЭКСПЕРТИЗА'),
              communicationStyle: extractField('СТИЛЬ ОБЩЕНИЯ'),
              meetingPreferences: extractField('ПРЕДПОЧТЕНИЯ ДЛЯ ВСТРЕЧ'),
              focusTime: extractField('РЕЖИМ ФОКУСНОЙ РАБОТЫ'),
              workStyle: extractField('СТИЛЬ РАБОТЫ'),
              careerGoals: extractField('КАРЬЕРНЫЕ ЦЕЛИ'),
              problemSolvingApproach: extractField('ПОДХОД К РЕШЕНИЮ ЗАДАЧ'),
            },
            profileLength: response.response.length,
            completeness: {
              missingFields: 0,
              notSpecifiedCount: notSpecifiedCount,
            },
          };
          
          console.log(`[Interview] RETURNING STRUCTURED RESULT:`, JSON.stringify(result, null, 2));
          return result;
        } else {
          console.log(`\n[Interview] ❌❌❌ INTERVIEW INCOMPLETE ❌❌❌`);
          console.log(`[Interview] User needs to complete interview\n`);
          return {
            hasInterview: false,
            message: `DEBUG: len=${response.response.length}/300, missing=${missingFields.length} [${missingFields.slice(0,3).join(',')}], notSpec=${notSpecifiedCount}/7`,
            missingFields,
            profileData: response.response,
          };
        }
      }
      
      console.log(`[Interview] ❌ No valid response from RAG\n`);
      return {
        hasInterview: false,
        message: 'Интервью не проводилось. Требуется делегировать Interview Agent.',
      };
    } catch (error: any) {
      console.error('[Interview] ❌ ERROR checking status:', error);
      return {
        hasInterview: false,
        message: `Ошибка при проверке статуса интервью: ${error.message}`,
      };
    }
  },
});
