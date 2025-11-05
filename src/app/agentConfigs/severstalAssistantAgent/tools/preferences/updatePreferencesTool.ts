import { tool } from '@openai/agents/realtime';
import { 
  updatePreferenceField,
  getUserPreferences,
  convertPreferencesToRussian,
  FIELD_MAPPING 
} from '@/app/lib/preferencesMcpClient';

/**
 * Tool for updating user preferences based on natural language requests
 */
export const updateUserPreferencesTool = tool({
  name: 'updateUserPreferencesTool',
  description: `Обновление предпочтений пользователя на основе естественных запросов.

Пользователь может просить изменить любые из 7 категорий предпочтений:
- компетенции (экспертиза, навыки)
- стиль общения (формальный/неформальный, детали)
- предпочтения по встречам (время, частота, формат)
- фокусная работа (время, условия)
- стиль работы (самостоятельно/в команде, детали)
- карьерные цели (планы, амбиции)
- подход к решению (методология, процесс)

Примеры запросов:
- "Давай изменим стиль общения на неформальный"
- "Изменим время встреч на четверг 14:00"
- "Обновим карьерные цели - хочу стать тимлидом"
- "Сделай фокусную работу с 9 до 12 утра"

Инструмент автоматически определяет категорию и обновляет соответствующее поле.`,
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'ID пользователя',
      },
      userRequest: {
        type: 'string',
        description: 'Естественный запрос пользователя на изменение предпочтений',
      },
      category: {
        type: 'string',
        description: 'Категория предпочтений для обновления',
        enum: [
          'компетенции',
          'стиль общения', 
          'предпочтения по встречам',
          'фокусная работа',
          'стиль работы',
          'карьерные цели',
          'подход к решению'
        ]
      },
      newValue: {
        type: 'string',
        description: 'Новое значение предпочтения',
      },
    },
    required: ['userId', 'userRequest', 'category', 'newValue'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userId, userRequest, category, newValue } = input;
    
    try {
      console.log(`[UpdatePreferences] Updating ${category} for user ${userId}`);
      console.log(`[UpdatePreferences] Request: "${userRequest}"`);
      console.log(`[UpdatePreferences] New value: "${newValue}"`);
      
      // Проверяем, что категория существует в маппинге
      if (!FIELD_MAPPING[category as keyof typeof FIELD_MAPPING]) {
        return {
          success: false,
          message: `Неизвестная категория предпочтений: ${category}`,
          category,
          error: 'Invalid category'
        };
      }
      
      // Обновляем предпочтение через MCP сервер
      const success = await updatePreferenceField(userId, category, newValue);
      
      if (success) {
        // Получаем обновленные предпочтения для подтверждения
        const updatedPreferences = await getUserPreferences(userId);
        const russianPreferences = updatedPreferences ? convertPreferencesToRussian(updatedPreferences) : {};
        
        return {
          success: true,
          message: `Предпочтение "${category}" успешно обновлено`,
          category,
          newValue,
          updatedField: russianPreferences[category] || newValue,
          confirmation: `✅ Изменение сохранено: ${category} → ${newValue}`
        };
      } else {
        return {
          success: false,
          message: `Ошибка при обновлении предпочтения "${category}"`,
          category,
          error: 'Update failed'
        };
      }
    } catch (error: any) {
      console.error('[UpdatePreferences] Error updating preferences:', error);
      return {
        success: false,
        message: `Ошибка при обновлении предпочтений: ${error.message}`,
        category,
        error: error.message
      };
    }
  },
});

/**
 * Tool for detecting preference update requests from natural language
 */
export const detectPreferenceUpdateRequest = tool({
  name: 'detectPreferenceUpdateRequest',
  description: `Анализ запроса пользователя на изменение предпочтений.

Определяет:
1. Хочет ли пользователь изменить предпочтения
2. Какую категорию нужно обновить
3. Какое новое значение установить

Поддерживает различные формулировки:
- "изменим стиль общения на..."
- "давай обновим время встреч..."
- "сделай фокусную работу..."
- "измени карьерные цели на..."
- "обнови подход к решению..."`,
  parameters: {
    type: 'object',
    properties: {
      userMessage: {
        type: 'string',
        description: 'Сообщение пользователя',
      },
    },
    required: ['userMessage'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { userMessage } = input;
    
    try {
      const message = userMessage.toLowerCase();
      
      // Ключевые слова для определения категорий
      const categoryKeywords = {
        'компетенции': ['компетенции', 'навыки', 'экспертиза', 'умения', 'знания'],
        'стиль общения': ['стиль общения', 'общение', 'коммуникация', 'разговор'],
        'предпочтения по встречам': ['встречи', 'встреч', 'время встреч', 'расписание'],
        'фокусная работа': ['фокусная работа', 'фокус', 'концентрация', 'глубокая работа'],
        'стиль работы': ['стиль работы', 'работа', 'рабочий процесс'],
        'карьерные цели': ['карьерные цели', 'цели', 'карьера', 'планы'],
        'подход к решению': ['подход к решению', 'решение задач', 'методология']
      };
      
      // Ключевые слова для определения намерения изменить
      const updateKeywords = [
        'измени', 'изменим', 'обнови', 'обновим', 'сделай', 'поставь', 
        'установи', 'поменяй', 'давай изменим', 'давай обновим'
      ];
      
      // Проверяем, есть ли намерение изменить
      const hasUpdateIntent = updateKeywords.some(keyword => message.includes(keyword));
      
      if (!hasUpdateIntent) {
        return {
          isUpdateRequest: false,
          message: 'Запрос не содержит намерения изменить предпочтения'
        };
      }
      
      // Определяем категорию
      let detectedCategory = null;
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => message.includes(keyword))) {
          detectedCategory = category;
          break;
        }
      }
      
      if (!detectedCategory) {
        return {
          isUpdateRequest: true,
          category: null,
          message: 'Обнаружено намерение изменить предпочтения, но не удалось определить категорию'
        };
      }
      
      // Извлекаем новое значение (простая логика)
      const newValue = extractNewValue(userMessage, detectedCategory);
      
      return {
        isUpdateRequest: true,
        category: detectedCategory,
        newValue: newValue || 'Новое значение не определено',
        message: `Обнаружен запрос на изменение "${detectedCategory}"`
      };
      
    } catch (error: any) {
      console.error('[DetectPreferenceUpdate] Error:', error);
      return {
        isUpdateRequest: false,
        message: `Ошибка при анализе запроса: ${error.message}`
      };
    }
  },
});

/**
 * Извлекает новое значение из сообщения пользователя
 */
function extractNewValue(message: string, category: string): string {
  // Простая логика извлечения значения после ключевых слов
  const updatePatterns = [
    /изменим?\s+[^на\s]+на\s+(.+)/i,
    /обновим?\s+[^на\s]+на\s+(.+)/i,
    /сделай\s+(.+)/i,
    /поставь\s+(.+)/i,
    /установи\s+(.+)/i,
    /поменяй\s+(.+)/i
  ];
  
  for (const pattern of updatePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Если не удалось извлечь, возвращаем часть после последнего слова категории
  const categoryWords = category.split(' ');
  const lastWord = categoryWords[categoryWords.length - 1];
  const lastWordIndex = message.toLowerCase().lastIndexOf(lastWord);
  
  if (lastWordIndex !== -1) {
    const afterCategory = message.substring(lastWordIndex + lastWord.length).trim();
    // Убираем служебные слова
    const cleaned = afterCategory.replace(/^(на|как|в|для|с)\s+/i, '').trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  
  return '';
}
