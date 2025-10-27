import { tool } from '@openai/agents/realtime';

// RAG API configuration
const RAG_API_BASE_URL = process.env.RAG_API_BASE_URL || 'http://79.132.139.57:9621';
const RAG_API_TIMEOUT = parseInt(process.env.RAG_API_TIMEOUT || '30000');

/**
 * Helper function to call RAG API directly (server-side)
 */
async function callRagApiDirect(endpoint: string, method: string, data?: any) {
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
 * Interview categories and their associated topics
 */
const INTERVIEW_CATEGORIES = {
  expertise: {
    name: 'Экспертиза и компетенции',
    priority: 1,
    topics: ['основные области экспертизы', 'технические навыки', 'профессиональный опыт'],
  },
  communication: {
    name: 'Стиль общения',
    priority: 2,
    topics: ['предпочитаемый тон общения', 'уровень детализации', 'формат обратной связи'],
  },
  schedule: {
    name: 'График и доступность',
    priority: 3,
    topics: ['удобное время для встреч', 'время фокусной работы', 'предпочтения по дням недели'],
  },
  workstyle: {
    name: 'Стиль работы',
    priority: 4,
    topics: ['подход к многозадачности', 'предпочтения в планировании', 'методы приоритизации'],
  },
  development: {
    name: 'Развитие и цели',
    priority: 5,
    topics: ['карьерные цели', 'интересы в обучении', 'желаемые проекты'],
  },
};

/**
 * Tool for progressive interview - saves insights as conversation flows naturally
 */
export const saveInterviewInsight = tool({
  name: 'saveInterviewInsight',
  description: `Сохранить инсайт из разговора с пользователем в его профиль предпочтений.

Используй этот инструмент каждый раз, когда пользователь делится важной информацией о своих предпочтениях,
стиле работы, экспертизе или других персональных аспектах. Не нужно задавать формальные вопросы -
просто сохраняй то, что естественно всплывает в беседе.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      category: {
        type: 'string',
        enum: ['expertise', 'communication', 'schedule', 'workstyle', 'development', 'other'],
        description: 'Категория инсайта (экспертиза, общение, график, стиль работы, развитие, другое)',
      },
      insight: {
        type: 'string',
        description: 'Конкретный инсайт или предпочтение пользователя в свободной форме',
      },
      context: {
        type: 'string',
        description: 'Опциональный контекст: что обсуждалось, когда появился этот инсайт',
      },
    },
    required: ['userId', 'category', 'insight'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, category, insight, context } = input;

    console.log(`[Interview2] Saving insight for user ${userId}, category: ${category}`);

    try {
      const workspaceName = `${userId}_user_key_preferences`;

      // Ensure workspace exists
      const workspacesResponse = await callRagApiDirect('/workspaces', 'GET');
      let workspaces = [];
      if (workspacesResponse.workspaces) {
        workspaces = workspacesResponse.workspaces;
      } else if (Array.isArray(workspacesResponse)) {
        workspaces = workspacesResponse;
      }

      const existingWorkspace = workspaces.find((ws: any) => ws.name === workspaceName);
      if (!existingWorkspace) {
        await callRagApiDirect('/workspaces', 'POST', { name: workspaceName });
        console.log(`[Interview2] Created workspace: ${workspaceName}`);
      }

      // Create insight document
      const categoryName = INTERVIEW_CATEGORIES[category as keyof typeof INTERVIEW_CATEGORIES]?.name || 'Общее';
      const timestamp = new Date().toISOString();

      const insightDocument = `
КАТЕГОРИЯ: ${categoryName}
ДАТА: ${timestamp}
${context ? `КОНТЕКСТ: ${context}\n` : ''}
ИНСАЙТ: ${insight}
---
Профиль пользователя: ${userId}
      `.trim();

      // Save to RAG
      await callRagApiDirect('/documents/text', 'POST', {
        text: insightDocument,
        file_source: `interview_insight_${category}_${Date.now()}`,
        workspace: workspaceName,
      });

      console.log(`[Interview2] Saved insight for user ${userId}`);

      return {
        success: true,
        message: `Сохранил! Буду учитывать это в дальнейшем общении.`,
        category: categoryName,
      };
    } catch (error: any) {
      console.error('[Interview2] Error saving insight:', error);
      return {
        success: false,
        message: `Не удалось сохранить: ${error.message}`,
      };
    }
  },
});

/**
 * Tool to retrieve user's profile insights
 */
export const getUserInsights = tool({
  name: 'getUserInsights',
  description: `Получить все сохраненные инсайты и предпочтения пользователя из его профиля.

Используй в начале разговора или когда нужно персонализировать помощь на основе известных предпочтений.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      category: {
        type: 'string',
        enum: ['expertise', 'communication', 'schedule', 'workstyle', 'development', 'all'],
        description: 'Категория для поиска (или all для всех)',
      },
    },
    required: ['userId'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, category = 'all' } = input;

    console.log(`[Interview2] Retrieving insights for user ${userId}, category: ${category}`);

    try {
      const workspaceName = `${userId}_user_key_preferences`;

      const query = category === 'all'
        ? `профиль и предпочтения пользователя ${userId}`
        : `${INTERVIEW_CATEGORIES[category as keyof typeof INTERVIEW_CATEGORIES]?.name} пользователя ${userId}`;

      const response = await callRagApiDirect('/query', 'POST', {
        query,
        mode: 'local',
        top_k: 5,
        workspace: workspaceName,
      });

      if (response && response.response &&
          !response.response.includes('не располагаю достаточной информацией') &&
          !response.response.includes('No relevant context found') &&
          !response.response.includes('не найдено')) {
        return {
          hasProfile: true,
          insights: response.response,
          message: 'Найдены сохраненные предпочтения пользователя',
        };
      }

      return {
        hasProfile: false,
        insights: null,
        message: 'Профиль пользователя еще не содержит данных',
      };
    } catch (error: any) {
      console.error('[Interview2] Error retrieving insights:', error);
      return {
        hasProfile: false,
        insights: null,
        message: `Ошибка при получении профиля: ${error.message}`,
      };
    }
  },
});

/**
 * Tool to suggest gentle conversation prompts to learn more about user
 */
export const suggestProfileQuestion = tool({
  name: 'suggestProfileQuestion',
  description: `Предложить естественный способ узнать больше о пользователе в контексте текущего разговора.

Используй когда замечаешь возможность естественно узнать что-то важное о предпочтениях или стиле работы пользователя,
не прерывая основной разговор формальным интервью.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      currentContext: {
        type: 'string',
        description: 'Текущий контекст разговора (о чем говорим)',
      },
      categoryToExplore: {
        type: 'string',
        enum: ['expertise', 'communication', 'schedule', 'workstyle', 'development'],
        description: 'Категория, которую хочется изучить',
      },
    },
    required: ['userId', 'currentContext', 'categoryToExplore'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, currentContext, categoryToExplore } = input;

    console.log(`[Interview2] Suggesting question for ${categoryToExplore} in context: ${currentContext}`);

    // Map categories to natural conversation prompts
    const questionTemplates = {
      expertise: [
        'Кстати, раз мы говорим об этом — в каких областях ты считаешь себя наиболее сильным? Буду знать, когда к тебе лучше обращаться.',
        'Судя по разговору, ты хорошо разбираешься в этой теме. Расскажи, какие еще области твоя сильная сторона?',
      ],
      communication: [
        'Как тебе удобнее получать обратную связь — сразу к делу или с контекстом? Хочу настроить свой стиль общения.',
        'Предпочитаешь, чтобы я был более формальным или можем общаться проще?',
      ],
      schedule: [
        'Когда тебе обычно удобнее назначать встречи? Хочу не попадать в неудобное время.',
        'Есть ли у тебя определенные часы, когда лучше не беспокоить — типа времени для глубокой работы?',
      ],
      workstyle: [
        'Ты предпочитаешь фокусироваться на одной задаче или тебе комфортно с несколькими параллельно?',
        'Как ты обычно подходишь к планированию задач — все расписываешь заранее или действуешь по ситуации?',
      ],
      development: [
        'Какие у тебя планы на развитие в ближайшее время? Может подскажу что-то интересное.',
        'Есть ли направления, в которых хотел бы прокачаться? Буду на примете держать подходящие возможности.',
      ],
    };

    const category = INTERVIEW_CATEGORIES[categoryToExplore as keyof typeof INTERVIEW_CATEGORIES];
    const templates = questionTemplates[categoryToExplore as keyof typeof questionTemplates] || [];
    const suggestedQuestion = templates[Math.floor(Math.random() * templates.length)];

    return {
      category: category.name,
      question: suggestedQuestion,
      priority: category.priority,
      message: `Предложение для естественного продолжения разговора`,
    };
  },
});

/**
 * Tool to check profile completeness and suggest what to learn next
 */
export const checkProfileCompleteness = tool({
  name: 'checkProfileCompleteness',
  description: `Проверить полноту профиля пользователя и определить, какие области еще стоит изучить.

Используй периодически, чтобы понимать, насколько хорошо ты знаешь пользователя и на что стоит обратить внимание.`,
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

    console.log(`[Interview2] Checking profile completeness for user ${userId}`);

    try {
      const workspaceName = `${userId}_user_key_preferences`;

      // Check each category
      const categoryStatus: Record<string, boolean> = {};

      for (const [key, category] of Object.entries(INTERVIEW_CATEGORIES)) {
        const response = await callRagApiDirect('/query', 'POST', {
          query: `${category.name} пользователя ${userId}`,
          mode: 'local',
          top_k: 1,
          workspace: workspaceName,
        });

        const hasData = response &&
          response.response &&
          !response.response.includes('не располагаю достаточной информацией') &&
          !response.response.includes('No relevant context found') &&
          response.response.length > 50;

        categoryStatus[key] = hasData;
      }

      const totalCategories = Object.keys(INTERVIEW_CATEGORIES).length;
      const completedCategories = Object.values(categoryStatus).filter(Boolean).length;
      const completenessPercent = Math.round((completedCategories / totalCategories) * 100);

      // Find missing categories with highest priority
      const missingCategories = Object.entries(INTERVIEW_CATEGORIES)
        .filter(([key]) => !categoryStatus[key])
        .sort(([, a], [, b]) => a.priority - b.priority)
        .map(([key, category]) => ({ key, ...category }));

      return {
        completeness: completenessPercent,
        completedCategories: Object.entries(categoryStatus)
          .filter(([, completed]) => completed)
          .map(([key]) => INTERVIEW_CATEGORIES[key as keyof typeof INTERVIEW_CATEGORIES].name),
        missingCategories: missingCategories.map(c => c.name),
        nextToExplore: missingCategories[0]?.key || null,
        message: `Профиль заполнен на ${completenessPercent}%. ${
          missingCategories.length > 0
            ? `Стоит узнать о: ${missingCategories[0].name}`
            : 'Профиль полностью заполнен!'
        }`,
      };
    } catch (error: any) {
      console.error('[Interview2] Error checking completeness:', error);
      return {
        completeness: 0,
        completedCategories: [],
        missingCategories: Object.values(INTERVIEW_CATEGORIES).map(c => c.name),
        nextToExplore: 'expertise',
        message: `Ошибка проверки: ${error.message}`,
      };
    }
  },
});
