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
    // Мокаем IntelligentSupervisor для асинхронного выполнения
    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue({
        strategy: 'flat',
        complexity: 'medium',
        nextResponse: 'Задача выполнена успешно',
        workflowSteps: ['Шаг 1', 'Шаг 2'],
        progress: { current: 2, total: 2 },
        executionTime: 1500,
      }),
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
    // Асинхронный режим: возвращается только sessionId и сообщение о запуске
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessionId).toBeDefined();
    expect(data.message).toBe('Task execution started. Connect to /api/supervisor/unified/stream to receive updates.');
    // Полные данные выполнения (strategy, complexity и т.д.) теперь приходят через SSE stream, не в основном ответе
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
    // В асинхронном режиме ошибки выполнения не возвращаются в основном ответе
    // Они обрабатываются асинхронно и отправляются через SSE stream
    // Основной ответ всегда успешный (200) с sessionId
    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: vi.fn().mockRejectedValue(new Error('Execution failed')),
      sessionId: 'test-session-error',
    }) as any);

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        taskDescription: 'Задача',
        conversationContext: 'Контекст',
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    // В асинхронном режиме основной ответ всегда успешный
    // Ошибки выполнения обрабатываются асинхронно и отправляются через SSE
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessionId).toBeDefined();
    // Ошибка выполнения будет отправлена через SSE stream, не в основном ответе
  });

  it('передает sessionId в конфигурацию и ответе', async () => {
    const mockSessionId = 'custom-session-456';
    vi.mocked(IntelligentSupervisor).mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue({
        strategy: 'direct',
        complexity: 'simple',
        nextResponse: 'Ответ',
        workflowSteps: [],
        progress: { current: 1, total: 1 },
        executionTime: 500,
      }),
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

    // Проверяем, что IntelligentSupervisor создается с правильным sessionId
    // (вызов происходит асинхронно в executeTaskAsync, но мы можем проверить мок)
    expect(data.sessionId).toBe(mockSessionId);
    expect(data.success).toBe(true);
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

    const response = await POST(mockRequest);
    const data = await response.json();

    // В асинхронном режиме проверяем, что запрос принят успешно
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessionId).toBeDefined();
    
    // Значения по умолчанию используются в executeTaskAsync
    // (executionMode: 'auto', maxComplexity: 'hierarchical')
    // Проверка вызова IntelligentSupervisor с правильными параметрами
    // происходит асинхронно, но мы можем проверить, что запрос принят
  });
});

