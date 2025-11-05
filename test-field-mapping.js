/**
 * Тест маппинга полей для MCP предпочтений
 */

const FIELD_MAPPING = {
  'компетенции': 'competencies',
  'стиль общения': 'communication_style', 
  'предпочтения по встречам': 'meeting_preferences',
  'фокусная работа': 'focused_work',
  'стиль работы': 'work_style',
  'карьерные цели': 'career_goals',
  'подход к решению': 'problem_solving_approach',
};

// Тестовые данные из интервью
const testInterviewData = {
  'компетенции': 'програмист',
  'стиль общения': 'неформально',
  'предпочтения по встречам': 'утром, короткие встречи',
  'фокусная работа': 'каждый день с 2 до 5',
  'стиль работы': 'над 1',
  'карьерные цели': 'рост компетенций',
  'подход к решению': 'обсудить',
};

console.log('🧪 Тест маппинга полей MCP предпочтений\n');

console.log('📋 Исходные данные интервью:');
Object.entries(testInterviewData).forEach(([ru, value]) => {
  console.log(`  ${ru}: ${value}`);
});

console.log('\n🔄 Конвертация в английские поля:');
const englishData = {};
Object.entries(testInterviewData).forEach(([ru, value]) => {
  const en = FIELD_MAPPING[ru];
  if (en) {
    englishData[en] = value;
    console.log(`  ${ru} → ${en}: ${value}`);
  } else {
    console.log(`  ❌ Поле не найдено: ${ru}`);
  }
});

console.log('\n📤 Итоговые данные для MCP API:');
console.log(JSON.stringify(englishData, null, 2));

// Проверяем, что все поля присутствуют
const requiredFields = Object.values(FIELD_MAPPING);
const presentFields = Object.keys(englishData);
const missingFields = requiredFields.filter(field => !presentFields.includes(field));

console.log('\n✅ Проверка полноты:');
console.log(`  Всего полей: ${requiredFields.length}`);
console.log(`  Заполнено: ${presentFields.length}`);
console.log(`  Отсутствует: ${missingFields.length}`);

if (missingFields.length > 0) {
  console.log('  ❌ Отсутствующие поля:', missingFields);
} else {
  console.log('  ✅ Все поля присутствуют');
}
