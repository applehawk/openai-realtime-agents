import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST, GET } from './route';

const ORIGINAL_FETCH = global.fetch;

describe('RAG route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  describe('POST', () => {
    it('успешно проксирует запрос к RAG MCP серверу', async () => {
      const mcpResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ text: 'Ответ от RAG сервера' }],
        },
      };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mcpResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const requestBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'lightrag_query',
          arguments: {
            query: 'тестовый запрос',
            mode: 'mix',
          },
        },
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(requestBody),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(mockRequest.json).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/mcp'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      // Проверяем что body содержит правильные данные
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const fetchBody = JSON.parse(fetchCall[1]?.body as string);
      expect(fetchBody.jsonrpc).toBe('2.0');
      expect(fetchBody.method).toBe('tools/call');
      expect(fetchBody.params.name).toBe('lightrag_query');
      expect(fetchBody.params.arguments.query).toBe('тестовый запрос');
      expect(fetchBody.params.arguments.mode).toBe('mix');
      expect(data).toEqual(mcpResponse);
    });

    it('возвращает ошибку при неуспешном ответе от RAG сервера', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response('Server Error', {
          status: 500,
        })
      );

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'lightrag_query', arguments: { query: 'test' } },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe(-32603);
    });

    it('обрабатывает таймаут соединения', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';

      global.fetch = vi.fn().mockRejectedValue(timeoutError);

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'lightrag_query', arguments: { query: 'test' } },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('timeout');
    });

    it('обрабатывает ошибку подключения', async () => {
      const connectionError = new Error('Failed to fetch');
      global.fetch = vi.fn().mockRejectedValue(connectionError);

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'lightrag_query', arguments: { query: 'test' } },
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('connection failed');
    });
  });

  describe('GET', () => {
    it('возвращает статус подключения при успешном health check', async () => {
      const healthResponse = { status: 'ok', version: '1.0' };

      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const response = await GET();
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('8000'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(data.status).toBe('ok');
      expect(data.ragServer).toEqual(healthResponse);
      expect(data.proxyUrl).toBe('/api/rag');
    });

    it('возвращает ошибку при недоступном сервере', async () => {
      const connectionError = new Error('Failed to fetch');
      global.fetch = vi.fn().mockRejectedValue(connectionError);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.error).toBeDefined();
    });
  });
});

