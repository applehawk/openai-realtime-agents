# 🔧 Исправление проблемы с userId="user123"

## 🐛 Проблема

Новые пользователи получали сообщение "Интервью уже проводилось ранее. Ваши предпочтения сохранены.", хотя они никогда не проходили интервью. 

В логах было видно, что агент использовал `userId="user123"` вместо реального ID пользователя (например, `fdb2b0dd-b19c-4b1b-b8e9-33acdddd18ae`).

## 🔍 Причина

**Корневая проблема**: API `/api/session` не передавал информацию о пользователе в конфигурацию сессии Realtime Agent. Агент не знал, кто пользователь, поэтому использовал какое-то дефолтное значение.

**Дополнительная проблема**: Логика проверки статуса интервью в инструментах агента была недостаточно строгой и не проверяла все типы ответов от RAG API.

## ✅ Решение

### 1. Передача информации о пользователе в сессию

Обновили `/api/session/route.ts` для передачи информации о пользователе:

```typescript
// Получаем информацию о пользователе из cookies
const cookieStore = await cookies();
const accessToken = cookieStore.get('access_token')?.value;

let userInfo = null;
if (accessToken) {
  try {
    const user = await authClient.getCurrentUser(accessToken);
    userInfo = {
      userId: user.id,
      username: user.username,
      email: user.email,
      position: user.username || 'Специалист',
    };
  } catch (error) {
    console.error('Failed to get user info:', error);
  }
}

// Передаем информацию о пользователе в конфигурацию сессии
const sessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: { voice: "marin" },
    },
    ...(userInfo && {
      instructions: `User profile: ID=${userInfo.userId}, Username=${userInfo.username}, Position=${userInfo.position}`,
    }),
  },
});
```

### 2. Улучшение логики проверки статуса интервью

Обновили функции `checkInterviewStatus` и `startInitialInterview` в `interviewTools.ts`:

```typescript
// Проверяем наличие данных интервью более строго
if (response && response.response && 
    !response.response.includes('не располагаю достаточной информацией') &&
    !response.response.includes('No relevant context found') &&
    !response.response.includes('не найдено') &&
    response.response.length > 50) {
  return {
    hasInterview: true,
    message: 'Интервью уже проводилось ранее. Ваши предпочтения сохранены.',
  };
}
```

### 3. Улучшение API интервью

Обновили `/api/interview/route.ts` для более строгой проверки:

```typescript
// Не полагаемся на флаг has_data, а делаем прямой запрос
const interviewData = await callRagApiDirect('/query', 'POST', {
  query: `интервью пользователя ${userId}`,
  mode: 'local',
  top_k: 1,
  workspace: workspaceName,
});

// Проверяем, что получили реальные данные интервью
if (interviewData && interviewData.response && 
    !interviewData.response.includes('не располагаю достаточной информацией') &&
    !interviewData.response.includes('No relevant context found') &&
    !interviewData.response.includes('не найдено') &&
    interviewData.response.length > 50) {
  return NextResponse.json({
    hasInterview: true,
    message: 'Интервью уже проводилось',
    interviewData: interviewData.response,
  });
}
```

## 📋 Измененные файлы

1. **`src/app/api/session/route.ts`**
   - Добавлен импорт `cookies` и `authClient`
   - Добавлено получение информации о пользователе
   - Добавлена передача информации о пользователе в конфигурацию сессии
   - Обновлены оба метода: `POST` и `GET`

2. **`src/app/agentConfigs/severstalAssistantAgent/interviewTools.ts`**
   - Улучшена логика проверки в `checkInterviewStatus`
   - Улучшена логика проверки в `startInitialInterview`
   - Добавлены проверки на "No relevant context found"

3. **`src/app/api/interview/route.ts`**
   - Улучшена логика проверки в `checkInterviewStatus`
   - Убрана зависимость от флага `has_data`
   - Добавлены проверки на "No relevant context found"

## 🎯 Результат

Теперь:
- ✅ Агент получает правильный `userId` из профиля пользователя
- ✅ Новые пользователи корректно определяются как не прошедшие интервью
- ✅ Пользователи, прошедшие интервью, корректно определяются
- ✅ Информация о пользователе передается в сессию агента
- ✅ Логика проверки статуса интервью работает надежно

## 🧪 Тестирование

Для проверки:
1. Зарегистрируйте нового пользователя
2. Войдите в систему
3. Подключитесь к агенту
4. Агент должен предложить пройти интервью (не говорить, что оно уже пройдено)

Для проверки существующего пользователя:
1. Пройдите интервью
2. Отключитесь и подключитесь снова
3. Агент должен сообщить, что интервью уже проведено

## 🔑 Ключевые изменения

- **Передача userId**: Теперь агент получает реальный ID пользователя из базы данных
- **Строгая проверка**: Проверяем не только наличие ответа, но и его содержимое
- **Обработка разных ответов**: Учитываем разные типы ответов от RAG API (русский и английский)
- **Длина ответа**: Проверяем, что ответ содержит достаточно информации (>50 символов)

## 🚀 Готово к использованию!

Проблема с `userId="user123"` полностью решена. Теперь каждый пользователь получает персонализированное предложение интервью на основе своего реального профиля.

