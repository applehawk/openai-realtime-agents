import { tool } from '@openai/agents/realtime';
import { 
  getUserPreferences,
  updatePreferenceField,
  convertPreferencesToRussian,
  FIELD_MAPPING 
} from '@/app/lib/preferencesMcpClient';

/**
 * Tool for querying user preferences from their personal workspace
 */
export const queryUserPreferences = tool({
  name: 'queryUserPreferences',
  description: `Запросить предпочтения и профиль пользователя из его персонального workspace.
  
Используйте этот инструмент для получения информации о:
- Стиле коммуникации пользователя
- Предпочитаемом времени для встреч
- Ключевых компетенциях и областях экспертизы
- Карьерных целях
- Рабочем стиле и подходе к задачам
- Времени для фокусной работы

Эта информация помогает персонализировать ответы и учитывать предпочтения пользователя.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      query: {
        type: 'string',
        description: 'Конкретный запрос о предпочтениях. Примеры: "стиль коммуникации", "предпочтения по встречам", "компетенции", "все предпочтения"',
      },
    },
    required: ['userId', 'query'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, query } = input;
    
    try {
      console.log(`[UserPreferences] Querying preferences for user ${userId}: ${query}`);
      
      // Get user preferences from MCP server
      const preferences = await getUserPreferences(userId);
      
      if (!preferences) {
        return {
          success: true,
          response: 'Предпочтения пользователя не найдены. Пройдите интервью для настройки персонализации.',
          workspace: `${userId}_user_key_preferences`,
        };
      }
      
      // Convert to Russian field names for display
      const russianPreferences = convertPreferencesToRussian(preferences);
      
      // Simple query matching for specific fields
      const queryLower = query.toLowerCase();
      let response = '';
      
      if (queryLower.includes('все') || queryLower.includes('полный') || queryLower.includes('профиль')) {
        // Return all preferences
        response = `Профиль пользователя ${userId}:\n\n`;
        for (const [field, value] of Object.entries(russianPreferences)) {
          response += `${field}: ${value}\n`;
        }
      } else if (queryLower.includes('компетенции') || queryLower.includes('эксперт')) {
        response = russianPreferences['компетенции'] || 'Не указано';
      } else if (queryLower.includes('стиль') && queryLower.includes('общения')) {
        response = russianPreferences['стиль общения'] || 'Не указано';
      } else if (queryLower.includes('встреч') || queryLower.includes('встречи')) {
        response = russianPreferences['предпочтения по встречам'] || 'Не указано';
      } else if (queryLower.includes('фокус') || queryLower.includes('концентрация')) {
        response = russianPreferences['фокусная работа'] || 'Не указано';
      } else if (queryLower.includes('рабочий') && queryLower.includes('стиль')) {
        response = russianPreferences['стиль работы'] || 'Не указано';
      } else if (queryLower.includes('карьер') || queryLower.includes('цели')) {
        response = russianPreferences['карьерные цели'] || 'Не указано';
      } else if (queryLower.includes('решение') || queryLower.includes('задач')) {
        response = russianPreferences['подход к решению'] || 'Не указано';
      } else {
        // Default: return all preferences
        response = `Профиль пользователя ${userId}:\n\n`;
        for (const [field, value] of Object.entries(russianPreferences)) {
          response += `${field}: ${value}\n`;
        }
      }
      
      return {
        success: true,
        response: response || 'Данные не найдены',
        workspace: `${userId}_user_key_preferences`,
      };
    } catch (error: any) {
      console.error('[UserPreferences] Error querying preferences:', error);
      return {
        success: false,
        response: `Ошибка при запросе предпочтений: ${error.message}`,
        workspace: `${userId}_user_key_preferences`,
      };
    }
  },
});


/**
 * Tool for updating user preferences
 */
export const updateUserPreferences = tool({
  name: 'updateUserPreferences',
  description: `Обновить предпочтения пользователя в его персональном workspace.
  
Используйте этот инструмент когда пользователь хочет изменить свои предпочтения:
- Изменить стиль коммуникации
- Изменить предпочитаемое время для встреч
- Обновить компетенции или области экспертизы
- Изменить карьерные цели
- Обновить рабочий стиль
- Изменить время для фокусной работы

Примеры запросов пользователя:
- "Теперь я предпочитаю формальный стиль общения"
- "Измени мое предпочитаемое время для встреч на вторую половину дня"
- "Обнови мои компетенции"
- "Я больше не хочу встречи по утрам"`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      category: {
        type: 'string',
        enum: [
          'стиль общения',
          'предпочтения по встречам',
          'компетенции',
          'карьерные цели',
          'рабочий стиль',
          'время фокусной работы',
          'подход к решению задач'
        ],
        description: 'Категория предпочтений для обновления',
      },
      newValue: {
        type: 'string',
        description: 'Новое значение предпочтения',
      },
    },
    required: ['userId', 'category', 'newValue'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, category, newValue } = input;
    
    try {
      console.log(`[UserPreferences] Updating ${category} for user ${userId}: ${newValue}`);
      
      // Update specific preference field using MCP server
      const success = await updatePreferenceField(userId, category, newValue);
      
      if (success) {
        return {
          success: true,
          message: `Предпочтения обновлены: ${category} → ${newValue}`,
          category,
          newValue,
          workspace: `${userId}_user_key_preferences`,
        };
      } else {
        return {
          success: false,
          message: `Ошибка при обновлении предпочтений: ${category}`,
          category,
          workspace: `${userId}_user_key_preferences`,
        };
      }
    } catch (error: any) {
      console.error('[UserPreferences] Error updating preferences:', error);
      return {
        success: false,
        message: `Ошибка при обновлении предпочтений: ${error.message}`,
        category,
        workspace: `${userId}_user_key_preferences`,
      };
    }
  },
});
