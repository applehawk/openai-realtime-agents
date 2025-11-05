/**
 * Тестовый скрипт для проверки интеграции с MCP сервером предпочтений
 * 
 * Запуск: node test-mcp-integration.js
 */

const PREFERENCES_API_URL = 'http://localhost:3000/api/preferences-mcp';
const MCP_DIRECT_URL = 'http://localhost:7001/api/v1/mcp/execute';

async function testMcpIntegration() {
  console.log('🧪 Тестирование интеграции с MCP сервером предпочтений\n');

  const testUserId = 'test-user-' + Date.now();

  // Тест 0: Health check
  console.log('0️⃣ Тест health check...');
  try {
    const healthResponse = await fetch('http://localhost:3000/api/preferences-mcp');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.health?.mcp ? 'УСПЕХ' : 'ОШИБКА');
    console.log('📊 Статус MCP:', healthData.mcpStatus);
    console.log('⏱️ Время ответа:', healthData.health?.timestamp);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  try {
    // Тест 1: Создание предпочтений
    console.log('1️⃣ Тест создания предпочтений...');
    const createResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'create_user_preferences',
        parameters: {
          user_id: testUserId,
          competencies: 'Python, JavaScript, React, Node.js',
          communication_style: 'Дружелюбный и поддерживающий',
          meeting_preferences: 'Утренние встречи, максимум 30 минут',
          focused_work: 'Глубокая работа в тихой обстановке',
          work_style: 'Самостоятельная работа с ежедневными синками',
          career_goals: 'Senior Full-Stack Developer, Tech Lead',
          problem_solving_approach: 'Итеративный подход, тестирование решений'
        },
        user_id: testUserId
      })
    });

    const createData = await createResponse.json();
    console.log('✅ Создание предпочтений:', createData.success ? 'УСПЕХ' : 'ОШИБКА');
    if (!createData.success) {
      console.log('❌ Ошибка:', createData.error || createData.message);
      return;
    }

    // Тест 2: Получение предпочтений
    console.log('\n2️⃣ Тест получения предпочтений...');
    const getResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'get_user_preferences',
        parameters: {},
        user_id: testUserId
      })
    });

    const getData = await getResponse.json();
    console.log('✅ Получение предпочтений:', getData.success ? 'УСПЕХ' : 'ОШИБКА');
    if (getData.success && getData.data?.preferences) {
      console.log('📋 Предпочтения:', {
        competencies: getData.data.preferences.competencies,
        communication_style: getData.data.preferences.communication_style,
        career_goals: getData.data.preferences.career_goals
      });
    }

    // Тест 3: Обновление поля
    console.log('\n3️⃣ Тест обновления поля...');
    const updateResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'update_preference_field',
        parameters: {
          field: 'career_goals',
          value: 'Tech Lead, CTO, Open Source Contributor'
        },
        user_id: testUserId
      })
    });

    const updateData = await updateResponse.json();
    console.log('✅ Обновление поля:', updateData.success ? 'УСПЕХ' : 'ОШИБКА');

    // Тест 4: Проверка обновления
    console.log('\n4️⃣ Тест проверки обновления...');
    const checkResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'get_user_preferences',
        parameters: {},
        user_id: testUserId
      })
    });

    const checkData = await checkResponse.json();
    if (checkData.success && checkData.data?.preferences) {
      console.log('✅ Обновленные карьерные цели:', checkData.data.preferences.career_goals);
    }

    // Тест 5: Поиск предпочтений
    console.log('\n5️⃣ Тест поиска предпочтений...');
    const searchResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'search_preferences',
        parameters: {
          field: 'competencies',
          search_term: 'Python'
        },
        user_id: 'system'
      })
    });

    const searchData = await searchResponse.json();
    console.log('✅ Поиск предпочтений:', searchData.success ? 'УСПЕХ' : 'ОШИБКА');
    if (searchData.success && searchData.data?.preferences) {
      console.log('🔍 Найдено записей:', searchData.data.preferences.length);
    }

    // Тест 6: Удаление предпочтений
    console.log('\n6️⃣ Тест удаления предпочтений...');
    const deleteResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'delete_user_preferences',
        parameters: {},
        user_id: testUserId
      })
    });

    const deleteData = await deleteResponse.json();
    console.log('✅ Удаление предпочтений:', deleteData.success ? 'УСПЕХ' : 'ОШИБКА');

    console.log('\n🎉 Все тесты завершены!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    console.log('\n💡 Убедитесь, что:');
    console.log('   - Next.js сервер запущен (npm run dev)');
    console.log('   - MCP сервер предпочтений запущен');
    console.log('   - API эндпоинт доступен по адресу:', PREFERENCES_API_URL);
  }
}

// Запуск тестов
testMcpIntegration();
