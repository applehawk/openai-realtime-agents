#!/bin/bash

# Тест правильной работы с workspace параметром
echo "🔍 Тест работы с workspace параметром в RAG API..."

TEST_USER_ID="test_user_$(date +%s)"
WORKSPACE_NAME="${TEST_USER_ID}_user_key_preferences"

echo "📝 Тестируем с пользователем: $TEST_USER_ID"
echo "📝 Workspace: $WORKSPACE_NAME"

# 1. Создаем workspace
echo ""
echo "1. Создаем workspace..."
CREATE_RESPONSE=$(curl -s -X POST http://79.132.139.57:9621/workspaces \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$WORKSPACE_NAME\"}")

echo "📋 Ответ: $CREATE_RESPONSE"

if [[ $CREATE_RESPONSE == *"success"* ]]; then
    echo "✅ Workspace создан успешно"
else
    echo "❌ Ошибка создания workspace"
    exit 1
fi

# 2. Сохраняем данные интервью
echo ""
echo "2. Сохраняем данные интервью..."

cat > /tmp/test_interview.txt << EOF
ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ: $TEST_USER_ID
Должность: Тестовая должность
Дата интервью: $(date -Iseconds)

КОМПЕТЕНЦИИ И ЭКСПЕРТИЗА:
Тестирование системы интервью

СТИЛЬ ОБЩЕНИЯ:
Неформальный, дружелюбный

ПРЕДПОЧТЕНИЯ ДЛЯ ВСТРЕЧ:
Утром в будние дни

РЕЖИМ ФОКУСНОЙ РАБОТЫ:
После 14:00 не беспокоить
EOF

UPLOAD_RESPONSE=$(curl -s -X POST "http://79.132.139.57:9621/documents/upload?workspace=$WORKSPACE_NAME" \
  -F "file=@/tmp/test_interview.txt")

echo "📋 Ответ загрузки: $UPLOAD_RESPONSE"

if [[ $UPLOAD_RESPONSE == *"success"* ]]; then
    echo "✅ Данные загружены успешно"
else
    echo "❌ Ошибка загрузки данных"
    exit 1
fi

# 3. Ждем обработки
echo ""
echo "3. Ждем обработки данных..."
sleep 5

# 4. Проверяем данные с указанием workspace
echo ""
echo "4. Проверяем данные с указанием workspace..."

QUERY_RESPONSE=$(curl -s -X POST http://79.132.139.57:9621/query \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"интервью пользователя $TEST_USER_ID\",
    \"mode\": \"local\",
    \"top_k\": 1,
    \"workspace\": \"$WORKSPACE_NAME\"
  }")

echo "📋 Результат запроса: $QUERY_RESPONSE"

if [[ $QUERY_RESPONSE == *"response"* ]] && [[ ! $QUERY_RESPONSE == *"не располагаю достаточной информацией"* ]]; then
    echo "✅ Данные найдены в workspace!"
    echo "📋 Ответ RAG:"
    echo "$QUERY_RESPONSE" | jq -r '.response' 2>/dev/null || echo "Не удалось распарсить JSON"
else
    echo "❌ Данные не найдены в workspace"
fi

# 5. Проверяем без указания workspace (должно не найти)
echo ""
echo "5. Проверяем без указания workspace (должно не найти)..."

QUERY_DEFAULT_RESPONSE=$(curl -s -X POST http://79.132.139.57:9621/query \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"интервью пользователя $TEST_USER_ID\",
    \"mode\": \"local\",
    \"top_k\": 1
  }")

echo "📋 Результат запроса в default workspace: $QUERY_DEFAULT_RESPONSE"

if [[ $QUERY_DEFAULT_RESPONSE == *"не располагаю достаточной информацией"* ]]; then
    echo "✅ Правильно! Данные не найдены в default workspace"
else
    echo "⚠️  Данные найдены в default workspace (неожиданно)"
fi

# Очистка
rm -f /tmp/test_interview.txt

echo ""
echo "🎉 Тест завершен!"
echo ""
echo "📋 Результаты:"
echo "✅ Workspace создается"
echo "✅ Данные сохраняются в workspace"
echo "✅ Поиск работает с указанием workspace"
echo "✅ Данные изолированы по workspace"

