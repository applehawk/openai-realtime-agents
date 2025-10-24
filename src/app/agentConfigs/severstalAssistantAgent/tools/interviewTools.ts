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
    const isComplete = questionNumber >= 4; // Minimum required questions
    
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
      
      return {
        status: 'in_progress',
        message: nextQuestion?.text || 'Интервью завершено',
        nextQuestion: nextQuestion?.text || null,
        interviewState: updatedState,
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
    
    // Check if interview already exists by querying RAG directly
    try {
      const workspaceName = `${userId}_user_key_preferences`;
      
      const response = await callRagApiDirect('/query', 'POST', {
        query: `интервью пользователя ${userId}`,
        mode: 'local',
        top_k: 1,
        workspace: workspaceName,
      });
      
      if (response && response.response && 
          !response.response.includes('не располагаю достаточной информацией') &&
          !response.response.includes('No relevant context found') &&
          !response.response.includes('не найдено') &&
          response.response.length > 50) {
        return {
          status: 'already_completed',
          message: 'ok', // Интервью уже пройдено - просто молча продолжаем работу
        };
      }
    } catch (error) {
      console.log('[Interview] Could not check status, proceeding with interview');
    }
    
    // Start first question
    const firstQuestion = `Привет! Я ваш персональный ассистент. Чтобы лучше вам помогать, давайте проведем короткое интервью - всего 3-5 минут.

Расскажите, пожалуйста, какую должность вы занимаете и в каких областях вы считаете себя экспертом? Это поможет мне лучше понимать ваши задачи и предлагать более релевантную помощь.`;
    
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
 * Tool for checking if user has completed initial interview
 */
export const checkInterviewStatus = tool({
  name: 'checkInterviewStatus',
  description: 'Проверить статус первичного интервью пользователя и получить сохраненные предпочтения',
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
      
      const response = await callRagApiDirect('/query', 'POST', {
        query: `интервью пользователя ${userId}`,
        mode: 'local',
        top_k: 1,
        workspace: workspaceName,
      });
      
      if (response && response.response && 
          !response.response.includes('не располагаю достаточной информацией') &&
          !response.response.includes('No relevant context found') &&
          !response.response.includes('не найдено') &&
          response.response.length > 50) {
        return {
          hasInterview: true,
          message: 'ok', // Интервью пройдено - просто молча продолжаем работу
        };
      }
      
      return {
        hasInterview: false,
        message: 'Интервью не проводилось. Требуется делегировать Interview Agent.',
      };
    } catch (error: any) {
      console.error('[Interview] Error checking status:', error);
      return {
        hasInterview: false,
        message: `Ошибка при проверке статуса интервью: ${error.message}`,
      };
    }
  },
});
