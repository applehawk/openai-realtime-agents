/**
 * Тест обновления предпочтений через естественную речь
 */

const PREFERENCES_API_URL = 'http://localhost:3000/api/preferences-mcp';

async function testPreferenceUpdates() {
  console.log('🧪 Тестирование обновления предпочтений через естественную речь\n');

  const testUserId = 'test-user-' + Date.now();

  try {
    // Создаем начальные предпочтения
    console.log('1️⃣ Создание начальных предпочтений...');
    const createResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'create_user_preferences',
        parameters: {
          user_id: testUserId,
          competencies: 'Python, JavaScript',
          communication_style: 'формальный',
          meeting_preferences: 'утром',
          focused_work: 'с 9 до 12',
          work_style: 'в команде',
          career_goals: 'стать senior разработчиком',
          problem_solving_approach: 'аналитический'
        },
        user_id: testUserId
      })
    });

    const createData = await createResponse.json();
    console.log('✅ Создание:', createData.success ? 'УСПЕХ' : 'ОШИБКА');

    // Тест 1: Изменение стиля общения
    console.log('\n2️⃣ Тест изменения стиля общения...');
    const update1Response = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'update_preference_field',
        parameters: {
          field: 'communication_style',
          value: 'неформальный и дружелюбный'
        },
        user_id: testUserId
      })
    });

    const update1Data = await update1Response.json();
    console.log('✅ Обновление стиля общения:', update1Data.success ? 'УСПЕХ' : 'ОШИБКА');

    // Тест 2: Изменение времени встреч
    console.log('\n3️⃣ Тест изменения времени встреч...');
    const update2Response = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'update_preference_field',
        parameters: {
          field: 'meeting_preferences',
          value: 'четверг 14:00, короткие встречи'
        },
        user_id: testUserId
      })
    });

    const update2Data = await update2Response.json();
    console.log('✅ Обновление времени встреч:', update2Data.success ? 'УСПЕХ' : 'ОШИБКА');

    // Тест 3: Изменение карьерных целей
    console.log('\n4️⃣ Тест изменения карьерных целей...');
    const update3Response = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'update_preference_field',
        parameters: {
          field: 'career_goals',
          value: 'стать тимлидом и открыть свой стартап'
        },
        user_id: testUserId
      })
    });

    const update3Data = await update3Response.json();
    console.log('✅ Обновление карьерных целей:', update3Data.success ? 'УСПЕХ' : 'ОШИБКА');

    // Проверяем финальные предпочтения
    console.log('\n5️⃣ Проверка финальных предпочтений...');
    const finalResponse = await fetch(PREFERENCES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'get_user_preferences',
        parameters: {},
        user_id: testUserId
      })
    });

    const finalData = await finalResponse.json();
    if (finalData.success && finalData.data?.preferences) {
      const prefs = finalData.data.preferences;
      console.log('📋 Финальные предпочтения:');
      console.log(`  Стиль общения: ${prefs.communication_style}`);
      console.log(`  Время встреч: ${prefs.meeting_preferences}`);
      console.log(`  Карьерные цели: ${prefs.career_goals}`);
      console.log(`  Компетенции: ${prefs.competencies}`);
    }

    console.log('\n🎉 Все тесты обновления предпочтений завершены!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Тест анализа естественных запросов
function testNaturalLanguageDetection() {
  console.log('\n🧠 Тест анализа естественных запросов\n');

  const testMessages = [
    'Давай изменим стиль общения на неформальный',
    'Изменим время встреч на четверг 14:00',
    'Обновим карьерные цели - хочу стать тимлидом',
    'Сделай фокусную работу с 9 до 12 утра',
    'Поменяй подход к решению на итеративный',
    'Привет, как дела?', // не должно определяться как запрос на изменение
    'Расскажи про погоду' // не должно определяться как запрос на изменение
  ];

  const categoryKeywords = {
    'компетенции': ['компетенции', 'навыки', 'экспертиза', 'умения', 'знания'],
    'стиль общения': ['стиль общения', 'общение', 'коммуникация', 'разговор'],
    'предпочтения по встречам': ['встречи', 'встреч', 'время встреч', 'расписание'],
    'фокусная работа': ['фокусная работа', 'фокус', 'концентрация', 'глубокая работа'],
    'стиль работы': ['стиль работы', 'работа', 'рабочий процесс'],
    'карьерные цели': ['карьерные цели', 'цели', 'карьера', 'планы'],
    'подход к решению': ['подход к решению', 'решение задач', 'методология']
  };

  const updateKeywords = [
    'измени', 'изменим', 'обнови', 'обновим', 'сделай', 'поставь', 
    'установи', 'поменяй', 'давай изменим', 'давай обновим'
  ];

  testMessages.forEach((message, index) => {
    console.log(`${index + 1}. "${message}"`);
    
    const messageLower = message.toLowerCase();
    const hasUpdateIntent = updateKeywords.some(keyword => messageLower.includes(keyword));
    
    if (hasUpdateIntent) {
      let detectedCategory = null;
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => messageLower.includes(keyword))) {
          detectedCategory = category;
          break;
        }
      }
      
      if (detectedCategory) {
        console.log(`   ✅ Запрос на изменение "${detectedCategory}"`);
      } else {
        console.log(`   ⚠️  Намерение изменить есть, но категория не определена`);
      }
    } else {
      console.log(`   ❌ Не является запросом на изменение`);
    }
    console.log('');
  });
}

// Запуск тестов
testPreferenceUpdates();
testNaturalLanguageDetection();
