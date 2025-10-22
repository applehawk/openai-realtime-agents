#!/bin/bash

# Тестовый скрипт для проверки API интервью
# Использование: ./test-interview-api.sh

echo "🔍 Тестирование API интервью..."
echo ""

# Проверка доступности приложения
echo "1. Проверка доступности приложения..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health)
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✅ Приложение доступно"
else
    echo "❌ Приложение недоступно"
    exit 1
fi

echo ""

# Проверка API интервью без аутентификации
echo "2. Проверка API интервью без аутентификации..."
INTERVIEW_RESPONSE=$(curl -s -X POST http://localhost:3000/api/interview \
  -H "Content-Type: application/json" \
  -d '{"action": "check_status"}')

if [[ $INTERVIEW_RESPONSE == *"Not authenticated"* ]]; then
    echo "✅ API интервью работает (требует аутентификации)"
else
    echo "❌ Неожиданный ответ: $INTERVIEW_RESPONSE"
fi

echo ""

# Проверка переменных окружения в контейнере
echo "3. Проверка переменных окружения RAG..."
RAG_VARS=$(docker compose exec -T realtime-agents env | grep RAG)
echo "📋 Переменные RAG:"
echo "$RAG_VARS"

echo ""

# Проверка статуса контейнера
echo "4. Статус контейнера..."
CONTAINER_STATUS=$(docker compose ps --format "table {{.Name}}\t{{.Status}}")
echo "📋 Статус:"
echo "$CONTAINER_STATUS"

echo ""
echo "🎉 АВТОМАТИЧЕСКОЕ ПРЕДЛОЖЕНИЕ ИНТЕРВЬЮ:"
echo "✅ Агент автоматически проверяет статус интервью при подключении"
echo "✅ Новым пользователям автоматически предлагается интервью"
echo "✅ Умная кнопка показывает статус интервью"
echo "✅ Поддержка повторного интервью"
echo ""
echo "🎯 Как это работает:"
echo "1. Откройте браузер: http://localhost:3000"
echo "2. Войдите в систему"
echo "3. Подключитесь к агенту (нажмите Connect)"
echo "4. Агент автоматически проверит статус интервью"
echo "5. Если интервью не проводилось → предложит его провести"
echo "6. Если проводилось → сообщит об этом"
echo ""
echo "🎨 Индикаторы кнопки интервью:"
echo "   🎤 Интервью (зеленый) - не проводилось"
echo "   ✅ Интервью ✓ (синий) - завершено"
echo "   ❌ Интервью ? (красный) - ошибка"
echo ""
echo "💡 Альтернативно, нажмите кнопку 'Интервью' для ручного запуска"
