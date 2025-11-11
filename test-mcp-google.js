/**
 * Тестовый скрипт для проверки интеграции с Google MCP сервером
 *
 * Использует ту же логику, что и mcpServerManager.ts
 *
 * Запуск: node test-mcp-google.js
 *
 * Требования:
 * - Запущенный oma-frontend (make prod)
 * - Валидный access_token (получить через логин на сайте)
 * - Запущенный Google MCP контейнер для пользователя
 */

// Базовые URL
const API_BASE = process.env.API_BASE || 'https://rndaibot.ru';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('❌ Ошибка: ACCESS_TOKEN environment variable не установлена');
  console.log('\n💡 Как получить токен:');
  console.log('   1. Откройте https://rndaibot.ru');
  console.log('   2. Залогиньтесь');
  console.log('   3. Откройте DevTools → Application → Cookies');
  console.log('   4. Скопируйте значение access_token');
  console.log('   5. Запустите:');
  console.log('      ACCESS_TOKEN=your_token node test-mcp-google.js\n');
  process.exit(1);
}

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Cookie': `access_token=${ACCESS_TOKEN}`,
    ...options.headers,
  };

  console.log(`\n🌐 ${options.method || 'GET'} ${endpoint}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Ошибка запроса: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testGoogleMcpIntegration() {
  console.log('🧪 Тестирование интеграции с Google MCP сервером');
  console.log('=' .repeat(60));

  // Step 1: Check container status
  console.log('\n📦 Шаг 1: Проверка статуса контейнера');
  console.log('-'.repeat(60));

  const containerResult = await apiRequest('/api/containers/status');

  if (!containerResult.success) {
    console.log('\n⚠️ Контейнер не запущен или недоступен');
    console.log('💡 Запустите контейнер через UI: User Profile → Start MCP Container');
    return;
  }

  const container = containerResult.data;
  console.log('✅ Контейнер найден:', {
    name: container.container_name,
    status: container.status,
    running: container.running,
    health: container.health,
    port: container.port,
  });

  if (!container.running || container.health !== 'healthy') {
    console.log('\n⚠️ Контейнер не готов');
    console.log(`   Статус: ${container.status}`);
    console.log(`   Health: ${container.health}`);
    return;
  }

  // Step 2: Construct MCP server URL (same logic as mcpServerManager.ts)
  console.log('\n🔗 Шаг 2: Конструирование URL MCP сервера');
  console.log('-'.repeat(60));

  const containerName = container.container_name;
  const username = containerName.replace('mcpgoogle-', '');
  const mcpUrl = `${API_BASE}/mcp/${username}/mcp`;

  console.log('📍 MCP Server URL:', mcpUrl);
  console.log('👤 Username:', username);
  console.log('🐳 Container:', containerName);
  console.log('\n💡 Схема проксирования:');
  console.log(`   OpenAI Realtime API → nginx (SSL) → ${containerName}:8000`);

  // Step 3: Test MCP server endpoint (SSE)
  console.log('\n🔌 Шаг 3: Проверка MCP SSE endpoint');
  console.log('-'.repeat(60));

  try {
    // Test SSE connection (initialize request)
    console.log('📡 Отправка initialize запроса к MCP серверу...');

    const sseResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // MCP server requires BOTH accept types: application/json AND text/event-stream
        'Accept': 'application/json, text/event-stream',
        'Cookie': `access_token=${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: 'test-mcp-google',
            version: '1.0.0',
          },
        },
      }),
    });

    if (!sseResponse.ok) {
      throw new Error(`HTTP ${sseResponse.status}: ${await sseResponse.text()}`);
    }

    console.log('✅ MCP SSE endpoint доступен');
    console.log(`   Status: ${sseResponse.status} ${sseResponse.statusText}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(sseResponse.headers), null, 2)}`);

    // Read first chunk of SSE stream
    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Read first few events (with timeout)
    const timeout = setTimeout(() => {
      console.log('\n⏱️ Таймаут чтения SSE stream (это нормально)');
      reader.cancel();
    }, 3000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop(); // Keep incomplete event in buffer

        for (const event of events) {
          if (event.trim()) {
            console.log('📨 SSE Event:', event.substring(0, 200));
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        throw err;
      }
    } finally {
      clearTimeout(timeout);
    }

  } catch (error) {
    console.error(`❌ Ошибка подключения к MCP: ${error.message}`);
    console.log('\n💡 Возможные причины:');
    console.log('   - Nginx proxy не настроен правильно');
    console.log('   - Контейнер недоступен из nginx');
    console.log('   - Проблемы с аутентификацией');
    return;
  }

  // Step 4: Check MCP tools via backend API
  console.log('\n🛠️ Шаг 4: Получение списка MCP tools через Backend API');
  console.log('-'.repeat(60));

  const toolsResult = await apiRequest('/api/mcp/tools');

  if (toolsResult.success) {
    console.log('✅ MCP Tools получены:', {
      count: toolsResult.data.toolCount,
      tools: toolsResult.data.tools?.slice(0, 5).map(t => t.name),
    });

    if (toolsResult.data.tools && toolsResult.data.tools.length > 5) {
      console.log(`   ... и еще ${toolsResult.data.tools.length - 5} tools`);
    }
  } else {
    console.log('⚠️ Не удалось получить список tools');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Тестирование завершено!');
  console.log('='.repeat(60));
  console.log('\n✅ MCP сервер готов к использованию через:');
  console.log(`   - Public URL: ${mcpUrl}`);
  console.log(`   - OpenAI Realtime API может обращаться к этому URL`);
  console.log(`   - Traffic: OpenAI → ${mcpUrl} → nginx → ${containerName}:8000`);
}

// Run tests
testGoogleMcpIntegration().catch(error => {
  console.error('\n💥 Критическая ошибка:', error);
  process.exit(1);
});
