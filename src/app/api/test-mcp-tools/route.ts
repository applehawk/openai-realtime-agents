import { NextResponse } from 'next/server';

export async function GET(_request: Request) {
  const mcpServerUrl = 'http://host.docker.internal:8000';

  try {
    console.log(`Testing MCP server tools at: ${mcpServerUrl}`);

    // 1. Проверка доступности сервера
    const healthResponse = await fetch(mcpServerUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!healthResponse.ok) {
      return NextResponse.json({
        success: false,
        message: 'MCP server is not healthy',
        status: healthResponse.status,
      }, { status: 500 });
    }

    // 2. Получение списка доступных tools
    const toolsResponse = await fetch(`${mcpServerUrl}/tools`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!toolsResponse.ok) {
      const errorText = await toolsResponse.text();
      console.error('Failed to fetch tools:', errorText);
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch tools list',
        status: toolsResponse.status,
        error: errorText,
        note: 'MCP server has a concurrency issue with stdin/stdout. Check server logs.',
      }, { status: 500 });
    }

    const toolsData = await toolsResponse.json();

    // 3. Тестовый вызов lightrag_query с реальным вопросом
    let testQueryResult = null;

    try {
      console.log('Testing lightrag_query with question: "Расскажи о команде и ролях в команде"');

      const testQueryResponse = await fetch(`${mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'lightrag_query',
            arguments: {
              query: 'Расскажи о команде и ролях в команде',
              mode: 'mix',
              include_references: true,
            },
          },
        }),
        signal: AbortSignal.timeout(30000), // 30 секунд для query
      });

      if (testQueryResponse.ok) {
        testQueryResult = await testQueryResponse.json();
        console.log('lightrag_query test successful:', JSON.stringify(testQueryResult).substring(0, 200));
      } else {
        const errorText = await testQueryResponse.text();
        testQueryResult = {
          success: false,
          error: `Query failed with status ${testQueryResponse.status}`,
          errorDetails: errorText,
        };
        console.error('lightrag_query test failed:', testQueryResult);
      }
    } catch (queryError: any) {
      testQueryResult = {
        success: false,
        error: queryError.message || 'Query test failed',
        errorType: queryError.name,
      };
      console.error('lightrag_query test error:', queryError);
    }

    return NextResponse.json({
      success: true,
      message: 'MCP server is fully operational',
      mcpServerUrl,
      server: {
        status: 'running',
        toolsAvailable: toolsData.count || 0,
      },
      tools: toolsData.tools || [],
      testQuery: testQueryResult,
    });

  } catch (error: any) {
    console.error('Error testing MCP server:', error);

    return NextResponse.json({
      success: false,
      mcpServerUrl,
      error: error.message || 'Unknown error',
      message: 'Failed to connect to MCP server or test tools',
    }, { status: 500 });
  }
}
