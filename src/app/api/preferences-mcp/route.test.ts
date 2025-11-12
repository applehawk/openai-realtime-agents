import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST, GET } from './route';

const ORIGINAL_FETCH = global.fetch;

describe('preferences-mcp route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('возвращает данные от MCP сервера при POST', async () => {
    const mcpResponse = { success: true, data: { ok: true } };

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mcpResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const requestBody = {
      tool_name: 'get_user_preferences',
      user_id: 'test-user',
      parameters: { field: 'value' },
    };

    const mockRequest = {
      json: vi.fn().mockResolvedValue(requestBody),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(mockRequest.json).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/mcp/call',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
    );
    expect(data).toEqual(mcpResponse);
  });

  it('возвращает ошибку 503 при недоступном MCP сервере', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error('Failed to fetch MCP server (ECONNREFUSED)')
    );

    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        tool_name: 'get_user_preferences',
        user_id: 'test-user',
        parameters: {},
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.message).toContain('недоступен');
  });

  it('возвращает статус подключения при GET', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{}', {
        status: 200,
      })
    );

    const response = await GET();
    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/apib/health',
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(data.mcpStatus).toBe('connected');
    expect(data.health?.mcp).toBe(true);
  });
});


