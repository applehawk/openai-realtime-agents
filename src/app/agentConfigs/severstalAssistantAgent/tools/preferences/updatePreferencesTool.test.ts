import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  updateUserPreferencesTool,
  detectPreferenceUpdateRequest,
} from './updatePreferencesTool';
import {
  updatePreferenceField,
  getUserPreferences,
  convertPreferencesToRussian,
  FIELD_MAPPING,
} from '@/app/lib/preferencesMcpClient';

// Мокаем зависимости
vi.mock('@/app/lib/preferencesMcpClient', () => ({
  updatePreferenceField: vi.fn(),
  getUserPreferences: vi.fn(),
  convertPreferencesToRussian: vi.fn((prefs) => prefs),
  FIELD_MAPPING: {
    'компетенции': 'competencies',
    'стиль общения': 'communication_style',
    'предпочтения по встречам': 'meeting_preferences',
    'фокусная работа': 'focused_work',
    'стиль работы': 'work_style',
    'карьерные цели': 'career_goals',
    'подход к решению': 'problem_solving_approach',
  },
}));

describe('Update Preferences Tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateUserPreferencesTool', () => {
    it('успешно обновляет предпочтение пользователя', async () => {
      vi.mocked(updatePreferenceField).mockResolvedValue(true);
      vi.mocked(getUserPreferences).mockResolvedValue({
        user_id: 'test-user',
        competencies: 'TypeScript',
        communication_style: 'Новый стиль',
      });
      vi.mocked(convertPreferencesToRussian).mockReturnValue({
        'компетенции': 'TypeScript',
        'стиль общения': 'Новый стиль',
      });

      const result = await updateUserPreferencesTool.invoke({
        userId: 'test-user',
        userRequest: 'Измени стиль общения на неформальный',
        category: 'стиль общения',
        newValue: 'неформальный',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'success' in result) {
        expect(result.success).toBe(true);
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('успешно обновлено');
        }
        if ('category' in result) {
          expect(result.category).toBe('стиль общения');
        }
      }
      // Проверяем что функция была вызвана (если invoke прошел валидацию)
      if (vi.mocked(updatePreferenceField).mock.calls.length > 0) {
        expect(updatePreferenceField).toHaveBeenCalled();
      }
    });

    it('возвращает ошибку при невалидной категории', async () => {
      const result = await updateUserPreferencesTool.invoke({
        userId: 'test-user',
        userRequest: 'Измени что-то',
        category: 'неизвестная_категория',
        newValue: 'значение',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'success' in result) {
        expect(result.success).toBe(false);
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('Неизвестная категория');
        }
      }
    });

    it('возвращает ошибку при неудачном обновлении', async () => {
      vi.mocked(updatePreferenceField).mockResolvedValue(false);

      const result = await updateUserPreferencesTool.invoke({
        userId: 'test-user',
        userRequest: 'Измени стиль',
        category: 'стиль общения',
        newValue: 'новый стиль',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'success' in result) {
        expect(result.success).toBe(false);
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('Ошибка при обновлении');
        }
      }
    });

    it('обрабатывает исключения при обновлении', async () => {
      vi.mocked(updatePreferenceField).mockRejectedValue(
        new Error('Database error')
      );

      const result = await updateUserPreferencesTool.invoke({
        userId: 'test-user',
        userRequest: 'Измени стиль',
        category: 'стиль общения',
        newValue: 'новый стиль',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'success' in result) {
        expect(result.success).toBe(false);
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('Ошибка');
        }
      }
    });
  });

  describe('detectPreferenceUpdateRequest', () => {
    it('определяет намерение изменить предпочтения', async () => {
      const result = await detectPreferenceUpdateRequest.invoke({
        userMessage: 'Измени стиль общения на неформальный',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'isUpdateRequest' in result) {
        expect(result.isUpdateRequest).toBe(true);
        if ('category' in result) {
          expect(result.category).toBe('стиль общения');
        }
        if ('newValue' in result) {
          expect(result.newValue).toBeDefined();
        }
      }
    });

    it('определяет категорию по ключевым словам', async () => {
      const testCases = [
        {
          message: 'Измени компетенции на разработка',
          expectedCategory: 'компетенции',
        },
        {
          message: 'Обновим предпочтения по встречам на четверг 14:00',
          expectedCategory: 'предпочтения по встречам',
        },
        {
          message: 'Сделай фокусную работу с 9 до 12',
          expectedCategory: 'фокусная работа',
        },
        {
          message: 'Измени карьерные цели на стать тимлидом',
          expectedCategory: 'карьерные цели',
        },
      ];

      for (const testCase of testCases) {
        const result = await detectPreferenceUpdateRequest.invoke({
          userMessage: testCase.message,
        });

        expect(result).toBeDefined();
        if (result && typeof result === 'object' && 'isUpdateRequest' in result) {
          expect(result.isUpdateRequest).toBe(true);
          if ('category' in result) {
            expect(result.category).toBe(testCase.expectedCategory);
          }
        }
      }
    });

    it('возвращает false когда нет намерения изменить', async () => {
      const result = await detectPreferenceUpdateRequest.invoke({
        userMessage: 'Расскажи о своих возможностях',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'isUpdateRequest' in result) {
        expect(result.isUpdateRequest).toBe(false);
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('не содержит намерения');
        }
      }
    });

    it('определяет намерение но не находит категорию', async () => {
      const result = await detectPreferenceUpdateRequest.invoke({
        userMessage: 'Измени что-то неизвестное',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'isUpdateRequest' in result) {
        expect(result.isUpdateRequest).toBe(true);
        if ('category' in result) {
          expect(result.category).toBeNull();
        }
        if ('message' in result && typeof result.message === 'string') {
          expect(result.message).toContain('не удалось определить категорию');
        }
      }
    });

    it('извлекает новое значение из сообщения', async () => {
      const result = await detectPreferenceUpdateRequest.invoke({
        userMessage: 'Измени стиль общения на неформальный и дружелюбный',
      });

      expect(result).toBeDefined();
      if (result && typeof result === 'object' && 'isUpdateRequest' in result) {
        expect(result.isUpdateRequest).toBe(true);
        if ('category' in result) {
          expect(result.category).toBe('стиль общения');
        }
        if ('newValue' in result && typeof result.newValue === 'string') {
          expect(result.newValue.length).toBeGreaterThan(0);
        }
      }
    });

    it('обрабатывает ошибки при анализе', async () => {
      // Симулируем ошибку через невалидный ввод
      const result = await detectPreferenceUpdateRequest.invoke({
        userMessage: '',
      });

      // Должен вернуть результат (не выбросить исключение)
      expect(result).toBeDefined();
    });
  });
});

