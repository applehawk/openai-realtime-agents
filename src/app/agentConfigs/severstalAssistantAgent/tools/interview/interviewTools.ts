import { tool } from '@openai/agents/realtime';
import { 
  checkUserPreferencesCompleteness, 
  getUserPreferences,
  convertPreferencesToRussian,
  convertPreferencesToEnglish,
  createUserPreferences,
  updateUserPreferences,
  FIELD_MAPPING 
} from '@/app/lib/preferencesMcpClient';

// Note: RAG-related functions removed - now using MCP preferences server

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
      // Save interview data to MCP preferences server
      try {
        console.log(`[Interview] Saving completed interview for user ${userId}`);
        
        // Convert Russian field names to English for MCP API
        const englishPreferences = convertPreferencesToEnglish({
          'компетенции': updatedState.competencies || '',
          'стиль общения': updatedState.communicationStyle || '',
          'предпочтения для встреч': updatedState.meetingPreferences || '',
          'фокусная работа': updatedState.focusTime || '',
          'стиль работы': updatedState.workStyle || '',
          'карьерные цели': updatedState.careerGoals || '',
          'подход к решению': updatedState.problemSolvingApproach || '',
        });
        
        // Check if preferences already exist
        const existingPreferences = await getUserPreferences(userId);
        
        let saveSuccess = false;
        if (existingPreferences) {
          // Update existing preferences
          saveSuccess = await updateUserPreferences(userId, englishPreferences);
          console.log(`[Interview] Updated existing preferences for user ${userId}: ${saveSuccess}`);
        } else {
          // Create new preferences
          saveSuccess = await createUserPreferences(userId, englishPreferences);
          console.log(`[Interview] Created new preferences for user ${userId}: ${saveSuccess}`);
        }
        
        if (saveSuccess) {
          return {
            status: 'completed',
            message: 'Интервью завершено! Ваши предпочтения сохранены и будут использоваться для персонализации взаимодействия.',
            nextQuestion: null,
            interviewState: updatedState,
          };
        } else {
          return {
            status: 'error',
            message: 'Интервью завершено, но возникла ошибка при сохранении данных. Попробуйте позже.',
            nextQuestion: null,
            interviewState: updatedState,
          };
        }
      } catch (error: any) {
        console.error('[Interview] Error saving data to MCP:', error);
        
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
      console.log(`[ManageUserInterview] Checking preferences for user ${userId}`);
      
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
      
      // Check preferences completeness using new MCP client
      const completenessResult = await checkUserPreferencesCompleteness(userId);
      
      console.log(`[ManageUserInterview] Completeness result for user ${userId}:`, {
        hasPreferences: completenessResult.hasPreferences,
        completeness: completenessResult.completeness,
        filledFields: completenessResult.filledFields.length,
        missingFields: completenessResult.missingFields.length,
      });
      
      // If no preferences exist
      if (!completenessResult.hasPreferences) {
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
          workspace: `${userId}_user_key_preferences`,
          filledFields: 0,
          totalFields: preferenceCategories.length,
          missingFields: preferenceCategories.map(c => c.key),
          nextQuestion: {
            number: 1,
            category: 'компетенции'
          }
        };
      }
      
      // Convert preferences to Russian field names for compatibility
      const preferences = completenessResult.preferences 
        ? convertPreferencesToRussian(completenessResult.preferences)
        : {};
      
      const completeness = completenessResult.completeness;
      const filledFields = completenessResult.filledFields;
      const missingFields = completenessResult.missingFields;
      
      console.log(`[ManageUserInterview] Final status for user ${userId}:`);
      console.log(`[ManageUserInterview] Filled fields: ${filledFields.length}, Missing: ${missingFields.length}, Completeness: ${completeness}%`);
      
      // Determine status and return appropriate response
      if (completeness === 100) {
        // Interview is complete - return all preferences
        return {
          interviewStatus: 'complete',
          completeness,
          message: 'Все необходимые данные собраны, можно переходить к задачам',
          preferences,
          workspace: `${userId}_user_key_preferences`,
          filledFields: filledFields.length,
          totalFields: preferenceCategories.length,
        };
      } else if (completeness > 0) {
        // Interview is incomplete - return partial preferences and missing fields
        const missingFieldsWithNumbers = missingFields.map(field => {
          const category = preferenceCategories.find(c => c.key === field);
          return category ? { key: field, questionNumber: category.questionNumber } : null;
        }).filter(Boolean);
        
        const nextQuestionNumber = Math.min(...missingFieldsWithNumbers.map(f => f!.questionNumber));
        const nextField = missingFieldsWithNumbers.find(f => f!.questionNumber === nextQuestionNumber);
        
        return {
          interviewStatus: 'incomplete',
          completeness,
          message: `Профиль неполный (${completeness}%) - доступны частичные предпочтения`,
          preferences,
          missingFields: missingFields,
          nextQuestion: nextField ? {
            number: nextField.questionNumber,
            category: nextField.key
          } : undefined,
          workspace: `${userId}_user_key_preferences`,
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
          workspace: `${userId}_user_key_preferences`,
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
