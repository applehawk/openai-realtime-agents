# RAG Integration - Quick Start

## ✅ Статус: Готово к использованию

MCP сервер LightRAG успешно интегрирован с агентом `severstalAssistant` и работает через UI.

## 🚀 Быстрый старт

### Использование через UI

1. Откройте https://rndaibot.ru/?agentConfig=chatSeverstalAssistant
2. Нажмите кнопку подключения к агенту
3. Задайте вопрос на русском, например:
   - "Расскажи о команде и ролях в команде"
   - "Что писали про проект?"
   - "Напомни задачи прошлого месяца"

### Проверка работы

**1. Health check:**
```bash
curl http://localhost:3000/api/rag
```

**2. Тестовый RAG запрос:**
```bash
curl http://localhost:3000/api/test-mcp-tools | jq .
```

**3. Логи сервера:**
```bash
docker compose logs -f realtime-agents | grep RAG
```

## 📋 Доступные инструменты

Агент `severstalAssistant` имеет **4 инструмента**:

1. **hosted_mcp** - Google Calendar/Gmail (n8n MCP)
2. **lightrag_query** - RAG запросы с LLM ответами
3. **lightrag_query_data** - Структурированные данные RAG
4. **delegateToSupervisor** - Делегирование сложных задач

## 🏗️ Архитектура

```
Браузер (HTTPS) → /api/rag → Next.js Server (Docker) → RAG MCP Server
                   ↓
            JSON-RPC proxy
```

**Почему через proxy?**
- OpenAI Realtime SDK выполняет tools в браузере
- Браузер не может подключиться к `host.docker.internal`
- HTTPS страница не может делать HTTP запросы (Mixed Content)

## 📚 Документация

- **Полная настройка**: [RAG_SETUP.md](RAG_SETUP.md)
- **Решение проблем**: [RAG_TROUBLESHOOTING.md](RAG_TROUBLESHOOTING.md)
- **API Proxy**: [src/app/api/rag/route.ts](src/app/api/rag/route.ts)
- **RAG Tools**: [src/app/agentConfigs/severstalAssistantAgent/ragTools.ts](src/app/agentConfigs/severstalAssistantAgent/ragTools.ts)

## 🔧 Основные команды

```bash
# Пересборка и запуск
docker compose build && docker compose up -d

# Просмотр логов
docker compose logs -f realtime-agents

# Проверка RAG proxy
curl http://localhost:3000/api/rag

# Тест RAG запроса
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lightrag_query","arguments":{"query":"Расскажи о команде","mode":"mix"}}}'
```

## ❓ Проблемы?

**Mixed Content ошибка в браузере?**
- ✅ Исправлено через API Proxy `/api/rag`

**"Function call completed but has no output"?**
- Проверьте что RAG сервер запущен: `curl http://localhost:8000`
- Проверьте proxy: `curl http://localhost:3000/api/rag`

**Другие проблемы:**
- См. [RAG_TROUBLESHOOTING.md](RAG_TROUBLESHOOTING.md)

## 📊 Endpoints

| Endpoint | Назначение | Доступность |
|----------|-----------|-------------|
| `/api/rag` | Proxy для RAG запросов | Браузер + Сервер |
| `/api/test-mcp` | Проверка подключения | Сервер |
| `/api/test-mcp-tools` | Полный тест с query | Сервер |
| `http://host.docker.internal:8000/mcp` | RAG MCP сервер | Только Docker |

## ✨ Готово!

Система работает и готова к использованию. Задавайте вопросы агенту через UI на https://rndaibot.ru
