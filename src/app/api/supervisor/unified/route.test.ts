import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from './route';
import { IntelligentSupervisor } from './intelligentSupervisor';

// Мокаем IntelligentSupervisor
vi.mock('./intelligentSupervisor', () => ({
  IntelligentSupervisor: vi.fn(),
}));

describe('Supervisor unified route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('успешно обрабатывает запрос и возвращает результат', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      strategy: 'flat',
      complexity: 'medium',
      nextResponse: 'Задача выполнена успешно',
      workflowSteps: ['Шаг 1', 'Шаг 2'],
      progress: { current: 2, total: 2 },
      executionTime: 1500,
    });

    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: mockExecute,
      sessionId: 'test-session-123',
    }) as any);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Прочитай письмо от Анны и назначь встречу',
        conversationContext: 'Пользователь просит обработать письмо',
        executionMode: 'auto',
        maxComplexity: 'hierarchical',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(mockRequest.json).toHaveBeenCalledTimes(1);
    expect(IntelligentSupervisor).toHaveBeenCalledWith(
      expect.objectContaining({
        enableProgressCallbacks: true,
        maxComplexity: 'hierarchical',
        maxNestingLevel: 3,
        maxSubtasksPerTask: 12,
      })
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        taskDescription: 'Прочитай письмо от Анны и назначь встречу',
        conversationContext: 'Пользователь просит обработать письмо',
        executionMode: 'auto',
      })
    );
    expect(data.strategy).toBe('flat');
    expect(data.complexity).toBe('medium');
    expect(data.nextResponse).toBe('Задача выполнена успешно');
    expect(data.workflowSteps).toEqual(['Шаг 1', 'Шаг 2']);
  });

  it('возвращает ошибку 400 при отсутствии обязательных параметров', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача без контекста',
        // conversationContext отсутствует
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required parameters');
    expect(data.required).toContain('taskDescription');
    expect(data.required).toContain('conversationContext');
  });

  it('возвращает ошибку 400 при невалидном executionMode', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
        executionMode: 'invalid_mode',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid executionMode');
    expect(data.allowed).toEqual(['auto', 'plan', 'execute']);
  });

  it('возвращает ошибку 400 при невалидном maxComplexity', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
        maxComplexity: 'invalid',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid maxComplexity');
    expect(data.allowed).toEqual(['flat', 'hierarchical']);
  });

  it('обрабатывает ошибки выполнения', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('Execution failed'));

    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: mockExecute,
    }) as any);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
    expect(data.details).toBe('Execution failed');
  });

  it('передает sessionId в конфигурацию и ответе', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      strategy: 'direct',
      complexity: 'simple',
      nextResponse: 'Ответ',
      workflowSteps: [],
      progress: { current: 1, total: 1 },
      executionTime: 500,
    });

    const mockSessionId = 'custom-session-456';
    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: mockExecute,
      sessionId: mockSessionId,
    }) as any);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
        sessionId: mockSessionId,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(IntelligentSupervisor).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: mockSessionId,
      })
    );
    expect(data.sessionId).toBe(mockSessionId);
  });

  it('использует значения по умолчанию для опциональных параметров', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      strategy: 'direct',
      complexity: 'simple',
      nextResponse: 'Ответ',
      workflowSteps: [],
      progress: { current: 1, total: 1 },
      executionTime: 500,
    });

    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: mockExecute,
      sessionId: 'auto-generated',
    }) as any);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
        // executionMode и maxComplexity не указаны
      }),
    } as unknown as NextRequest;

    await POST(mockRequest);

    expect(IntelligentSupervisor).toHaveBeenCalledWith(
      expect.objectContaining({
        maxComplexity: 'hierarchical', // значение по умолчанию
      })
    );
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: 'auto', // значение по умолчанию
      })
    );
  });
});

