#!/bin/bash

# Простой тест создания workspace и сохранения данных
echo "🔍 Простой тест RAG API..."

# Создаем временный файл с данными
TEST_USER_ID="test_user_$(date +%s)"
WORKSPACE_NAME="${TEST_USER_ID}_user_key_preferences"

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

echo "📝 Создаем workspace: $WORKSPACE_NAME"

# Создаем workspace
CREATE_RESPONSE=$(curl -s -X POST http://79.132.139.57:9621/workspaces \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$WORKSPACE_NAME\"}")

echo "📋 Ответ создания workspace: $CREATE_RESPONSE"

echo ""
echo "📝 Сохраняем данные через upload..."

# Сохраняем данные через upload
UPLOAD_RESPONSE=$(curl -s -X POST "http://79.132.139.57:9621/documents/upload?workspace=$WORKSPACE_NAME" \
  -F "file=@/tmp/test_interview.txt")

echo "📋 Ответ загрузки: $UPLOAD_RESPONSE"

if [[ $UPLOAD_RESPONSE == *"success"* ]] || [[ $UPLOAD_RESPONSE == *"track_id"* ]]; then
    echo "✅ Данные загружены успешно"
    
    echo ""
    echo "⏳ Ждем обработки..."
    sleep 5
    
    echo "📝 Проверяем данные..."
    
    # Проверяем данные
    QUERY_RESPONSE=$(curl -s -X POST http://79.132.139.57:9621/query \
      -H "Content-Type: application/json" \
      -d "{
        \"query\": \"интервью пользователя $TEST_USER_ID\",
        \"workspace\": \"$WORKSPACE_NAME\",
        \"mode\": \"local\",
        \"top_k\": 1
      }")
    
    echo "📋 Результат запроса: $QUERY_RESPONSE"
    
    if [[ $QUERY_RESPONSE == *"response"* ]]; then
        echo "✅ Данные найдены в RAG!"
    else
        echo "❌ Данные не найдены"
    fi
else
    echo "❌ Ошибка загрузки данных"
fi

# Очистка
rm -f /tmp/test_interview.txt

echo ""
echo "🎉 Тест завершен!"

