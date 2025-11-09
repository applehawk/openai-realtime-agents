# HITL Debugging Guide

## Проверка работы HITL механизма

### 1. Проверьте Backend логи

В терминале где запущен `npm run dev` ищите:

```
[HITLStore] Created pending approval: { sessionId: 'xxx', itemId: 'hitl-xxx-xxx', type: 'PLAN_APPROVAL' }
[IntelligentSupervisor] Generating plan with TaskPlannerAgent...
[ProgressEmitter] Session xxx: hitl_request - Ожидание утверждения плана... (50%)
```

### 2. Проверьте Frontend логи (Browser Console)

Откройте Developer Tools → Console и ищите:

```
[useTaskProgress] Update: {type: 'hitl_request', hitlData: {...}}
[TaskProgressMessage] HITL request received: {itemId: 'hitl-xxx-xxx', type: 'PLAN_APPROVAL', ...}
[TranscriptContext] Creating HITL approval request: {sessionId: 'xxx', hitlType: 'PLAN_APPROVAL'}
```

### 3. Проверьте SSE соединение

В Network tab (Developer Tools):
- Найдите запрос к `/api/supervisor/unified/stream?sessionId=xxx`
- Должен быть статус `200` и тип `eventsource`
- В ответах ищите события типа `hitl_request`

### 4. Проверьте Transcript Items

В React DevTools → Components → TranscriptProvider:
- Посмотрите на `transcriptItems`
- Должен быть item с `type: "HITL_APPROVAL"`
- Проверьте `hitlData.itemId` - он должен совпадать с тем, что в SSE событии

### 5. Тестирование PLAN_APPROVAL

Запросите у ассистента:
```
"Создай план работы по анализу продаж за последний квартал"
```

Должен появиться виджет с планом для утверждения.

### 6. Тестирование DECOMPOSITION_DECISION

Запросите сложную задачу:
```
"Найди 100 клиентов и отправь каждому персонализированное письмо"
```

DecisionAgent должен предложить декомпозицию, и появится виджет для подтверждения.

### 7. Возможные проблемы

#### Виджет не появляется

**Причина 1**: SSE событие не доходит до фронтенда
- Проверьте Network tab → stream endpoint
- Убедитесь что событие `hitl_request` присутствует

**Причина 2**: TaskProgressMessage не обрабатывает событие
- Проверьте console логи `[TaskProgressMessage] HITL request received`
- Если лога нет - событие не дошло из useTaskProgress

**Причина 3**: Дублирующиеся itemId
- В старой версии мы генерировали itemId дважды
- ИСПРАВЛЕНО: теперь hitlStore возвращает itemId, который используется в SSE

**Причина 4**: Виджет не рендерится в Transcript
- Проверьте что в `transcriptItems` есть item с `type: "HITL_APPROVAL"`
- Проверьте условие рендеринга в Transcript.tsx (строка 209)

#### Approve/Reject не работает

**Причина**: API endpoint возвращает ошибку
- Проверьте Network tab → approve/reject запросы
- Посмотрите response body для деталей ошибки
- Убедитесь что `itemId` правильный

### 8. Ручное тестирование API

Если виджет появился, но кнопки не работают:

```bash
# Get session ID from logs
SESSION_ID="session-xxx"
ITEM_ID="hitl-xxx-xxx"

# Test approve
curl -X POST http://localhost:3000/api/supervisor/unified/hitl/approve \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"itemId\":\"$ITEM_ID\",\"decision\":\"approved\"}"

# Should return: {"success":true}
```

### 9. Debug checklist

- [ ] Backend запущен (`npm run dev`)
- [ ] Frontend открыт в браузере
- [ ] Developer Tools открыты (Console + Network tabs)
- [ ] Запрошена задача, которая требует plan или decomposition
- [ ] SSE соединение установлено (stream endpoint)
- [ ] События `hitl_request` видны в Network → EventStream
- [ ] Console логи показывают обработку событий
- [ ] Виджет появился в чате
- [ ] Кнопки Approve/Reject работают

### 10. Если ничего не помогает

Добавьте дополнительное логирование:

```typescript
// В TaskProgressMessage.tsx после useTaskProgress
console.log('[DEBUG] All updates:', updates);
console.log('[DEBUG] Latest update type:', updates[updates.length - 1]?.type);
console.log('[DEBUG] Has hitlData:', !!updates.find(u => u.hitlData));
```

Это покажет, какие события приходят и есть ли среди них `hitl_request`.
