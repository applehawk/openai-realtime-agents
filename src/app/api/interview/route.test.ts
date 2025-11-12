import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from './route';
import { cookies } from 'next/headers';
import { authClient } from '@/app/lib/authClient';
import { callRagApiDirect } from '@/app/lib/ragApiClient';

// Мокаем зависимости
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/app/lib/authClient', () => ({
  authClient: {
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('@/app/lib/ragApiClient', () => ({
  callRagApiDirect: vi.fn(),
}));

const ORIGINAL_FETCH = global.fetch;

describe('Interview route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  describe('POST - check_status', () => {
    it('возвращает hasInterview: false когда workspace не существует', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      vi.mocked(callRagApiDirect).mockResolvedValue([]);

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'check_status',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.hasInterview).toBe(false);
      expect(data.message).toContain('не проводилось');
    });

    it('возвращает hasInterview: true когда интервью завершено', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      const workspaceName = 'test-user_user_key_preferences';

      // Мокаем workspace exists и множественные запросы для проверки категорий
      let queryCallCount = 0;
      vi.mocked(callRagApiDirect).mockImplementation(async (endpoint: string, method?: string, data?: any) => {
        if (endpoint === '/workspaces' && method === 'GET') {
          return [{ name: workspaceName }];
        }
        if (endpoint === '/query' && method === 'POST') {
          queryCallCount++;
          // Первый запрос - общий запрос об интервью
          if (queryCallCount === 1) {
            return {
              response: 'Длинный ответ с информацией об интервью пользователя test-user. Компетенции: разработка. Стиль общения: неформальный. Предпочтения по встречам: утро вторника. Фокусная работа: с 9 до 12. Стиль работы: самостоятельно. Карьерные цели: стать тимлидом. Подход к решению: сначала сам проработать.',
            };
          }
          // Последующие запросы - проверка конкретных категорий (должно быть 7 вызовов)
          // Все категории должны вернуть данные
          return {
            response: `Данные о категории для пользователя test-user. Информация достаточно подробная для проверки.`,
          };
        }
        return {};
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'check_status',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.hasInterview).toBe(true);
      expect(data.completeness).toBeGreaterThan(0);
      // Проверяем что были сделаны запросы для проверки категорий
      // 1 общий запрос + 7 запросов для категорий = минимум 8 вызовов
      expect(queryCallCount).toBeGreaterThanOrEqual(8);
    });

    it('возвращает ошибку при отсутствии токена', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any);

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'check_status',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.detail).toBe('Not authenticated');
    });
  });

  describe('POST - save_data', () => {
    it('успешно сохраняет данные интервью', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      // Мокаем workspace exists и сохранение данных
      let savedData: any = null;
      vi.mocked(callRagApiDirect).mockImplementation(async (endpoint: string, method: string, data?: any) => {
        if (endpoint === '/workspaces' && method === 'GET') {
          return [{ name: 'test-user_user_key_preferences' }];
        }
        if (endpoint === '/workspaces' && method === 'POST') {
          return { success: true, name: 'test-user_user_key_preferences' };
        }
        if (endpoint === '/documents/text' && method === 'POST') {
          // Сохраняем данные для проверки
          savedData = data;
          // Проверяем что переданы правильные данные для сохранения
          expect(data).toBeDefined();
          expect(data.text).toBe('Данные интервью пользователя');
          expect(data.file_source).toBe('initial_interview');
          expect(data.workspace).toBe('test-user_user_key_preferences');
          return { success: true };
        }
        return {};
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'save_data',
          data: 'Данные интервью пользователя',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('успешно сохранены');
      // Проверяем что данные были сохранены с правильными параметрами
      expect(savedData).toBeDefined();
      expect(savedData.text).toBe('Данные интервью пользователя');
    });

    it('создает workspace если его не существует', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      let workspaceCreated = false;
      vi.mocked(callRagApiDirect).mockImplementation(async (endpoint: string, method: string, data?: any) => {
        if (endpoint === '/workspaces' && method === 'GET') {
          return [];
        }
        if (endpoint === '/workspaces' && method === 'POST') {
          workspaceCreated = true;
          return { success: true };
        }
        if (endpoint === '/documents/text' && method === 'POST') {
          return { success: true };
        }
        return {};
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'save_data',
          data: 'Данные интервью',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(workspaceCreated).toBe(true);
    });
  });

  describe('POST - create_workspace', () => {
    it('успешно создает workspace', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      vi.mocked(callRagApiDirect).mockImplementation(async (endpoint: string, method: string) => {
        if (endpoint === '/workspaces' && method === 'GET') {
          return [];
        }
        if (endpoint === '/workspaces' && method === 'POST') {
          return { success: true };
        }
        return {};
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'create_workspace',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('создано');
    });
  });

  describe('POST - invalid action', () => {
    it('возвращает ошибку при невалидном action', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'invalid_action',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.detail).toBe('Invalid action');
    });
  });

  describe('POST - error handling', () => {
    it('обрабатывает ошибки при сохранении данных', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-token' }),
      } as any);

      vi.mocked(authClient.getCurrentUser).mockResolvedValue({
        id: 'test-user',
        username: 'test-user',
      });

      vi.mocked(callRagApiDirect).mockRejectedValue(new Error('RAG server error'));

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'save_data',
          data: 'Данные',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.detail).toContain('Ошибка');
    });
  });
});

