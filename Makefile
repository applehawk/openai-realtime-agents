# Переменные для docker-compose файлов
DEV_COMPOSE = docker compose -f docker-compose.dev.yml
PROD_COMPOSE = docker compose -f docker-compose.yml

# Цвета для вывода
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

.PHONY: help install dev-npm build start lint test-api-key dev prod stop-dev stop-prod stop-all build-dev build-prod dev-logs prod-logs restart-dev restart-prod shell-dev shell-prod updown mcp-test mcp-stop mcp-logs mcp-restart

help: ## Показать справку по командам
	@echo "$(GREEN)Доступные команды:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}'

# ====== NPM команды ======
install: ## Установить зависимости
	npm install

dev-npm: ## Запустить development server через npm
	npm run dev

build: ## Собрать проект
	npm run build

start: ## Запустить production server через npm
	npm start

lint: ## Запустить линтер
	npm run lint

# ====== Docker окружения ======
dev: ## Запустить dev окружение
	@echo "$(GREEN)Запуск dev окружения...$(RESET)"
	@echo "Используется docker-compose.dev.yml и .env.dev"
	$(DEV_COMPOSE) down && $(DEV_COMPOSE) up --build -d
	@echo "$(GREEN)Dev окружение запущено на порту 3001$(RESET)"

prod: ## Запустить prod окружение
	@echo "$(GREEN)Запуск prod окружения...$(RESET)"
	@echo "Используется docker-compose.yml и .env"
	$(PROD_COMPOSE) down && $(PROD_COMPOSE) up --build -d
	@echo "$(GREEN)Prod окружение запущено на порту 3000$(RESET)"

stop-dev: ## Остановить dev окружение
	@echo "$(YELLOW)Остановка dev окружения...$(RESET)"
	$(DEV_COMPOSE) down

stop-prod: ## Остановить prod окружение
	@echo "$(YELLOW)Остановка prod окружения...$(RESET)"
	$(PROD_COMPOSE) down

stop-all: ## Остановить все окружения
	@echo "$(YELLOW)Остановка всех окружений...$(RESET)"
	$(DEV_COMPOSE) down
	$(PROD_COMPOSE) down

build-dev: ## Пересобрать dev окружение
	@echo "$(GREEN)Пересборка dev окружения...$(RESET)"
	$(DEV_COMPOSE) build --no-cache
	$(DEV_COMPOSE) up -d

build-prod: ## Пересобрать prod окружение
	@echo "$(GREEN)Пересборка prod окружения...$(RESET)"
	$(PROD_COMPOSE) build --no-cache
	$(PROD_COMPOSE) up -d

dev-logs: ## Показать логи dev окружения
	@echo "$(GREEN)Логи dev окружения (Ctrl+C для выхода)...$(RESET)"
	$(DEV_COMPOSE) logs -f --tail 500 realtime-agents

prod-logs: ## Показать логи prod окружения
	@echo "$(GREEN)Логи prod окружения (Ctrl+C для выхода)...$(RESET)"
	$(PROD_COMPOSE) logs -f --tail 500 realtime-agents

restart-dev: ## Перезапустить dev окружение
	@echo "$(YELLOW)Перезапуск dev окружения...$(RESET)"
	$(DEV_COMPOSE) restart

restart-prod: ## Перезапустить prod окружение
	@echo "$(YELLOW)Перезапуск prod окружения...$(RESET)"
	$(PROD_COMPOSE) restart

shell-dev: ## Открыть shell в dev контейнере
	$(DEV_COMPOSE) exec realtime-agents sh

shell-prod: ## Открыть shell в prod контейнере
	$(PROD_COMPOSE) exec realtime-agents sh

updown: ## Полный цикл: pull, rebuild и restart prod окружения
	@echo "$(GREEN)========================================$(RESET)"
	@echo "$(GREEN)Step 1/3: Pulling latest code from git...$(RESET)"
	@echo "$(GREEN)========================================$(RESET)"
	git pull
	@echo ""
	@echo "$(GREEN)========================================$(RESET)"
	@echo "$(GREEN)Step 2/3: Stopping Docker containers...$(RESET)"
	@echo "$(GREEN)========================================$(RESET)"
	$(PROD_COMPOSE) down
	@echo ""
	@echo "$(GREEN)========================================$(RESET)"
	@echo "$(GREEN)Step 3/3: Building and starting Docker containers...$(RESET)"
	@echo "$(GREEN)========================================$(RESET)"
	$(PROD_COMPOSE) up --build --force-recreate --remove-orphans -d
	@echo "$(GREEN)Prod окружение обновлено!$(RESET)"

# ====== Другие команды ======
test-api-key: ## Протестировать OpenAI API key
	@echo "$(GREEN)Testing OpenAI API key...$(RESET)"
	@source .env && curl -s -X POST https://api.openai.com/v1/realtime/client_secrets \
		-H "Authorization: Bearer $${OPENAI_API_KEY}" \
		-H "Content-Type: application/json" \
		-d '{\
			"session": {\
			"type": "realtime",\
			"model": "gpt-realtime"\
			}\
		}'

# MCP Google test container commands
mcp-test:
	@echo "========================================"
	@echo "Starting MCP Google test container..."
	@echo "========================================"
	@if [ -z "$$MCP_REFRESH_TOKEN" ]; then \
		echo "Error: MCP_REFRESH_TOKEN environment variable is not set"; \
		echo "Usage: MCP_REFRESH_TOKEN=your_token GOOGLE_CLIENT_ID=your_id GOOGLE_CLIENT_SECRET=your_secret make mcp-test"; \
		exit 1; \
	fi
	@if [ -z "$$GOOGLE_CLIENT_ID" ]; then \
		echo "Error: GOOGLE_CLIENT_ID environment variable is not set"; \
		exit 1; \
	fi
	@if [ -z "$$GOOGLE_CLIENT_SECRET" ]; then \
		echo "Error: GOOGLE_CLIENT_SECRET environment variable is not set"; \
		exit 1; \
	fi
	@docker run -d \
		--name mcpgoogle-testuser \
		-p 3001:8000 \
		-e AUTH_MODE=oma_backend \
		-e OMA_BACKEND_URL=https://rndaibot.ru/api/v1 \
		-e MCP_REFRESH_TOKEN=$$MCP_REFRESH_TOKEN \
		-e GOOGLE_CLIENT_ID=$$GOOGLE_CLIENT_ID \
		-e GOOGLE_CLIENT_SECRET=$$GOOGLE_CLIENT_SECRET \
		mcpgoogle:latest
	@echo ""
	@echo "Container started successfully!"
	@echo "Container name: mcpgoogle-testuser"
	@echo "Port mapping: 3001:8000"
	@echo ""
	@echo "View logs with: make mcp-logs"

mcp-stop:
	@echo "Stopping and removing MCP Google test container..."
	@docker stop mcpgoogle-testuser 2>/dev/null || true
	@docker rm mcpgoogle-testuser 2>/dev/null || true
	@echo "Container stopped and removed."

mcp-logs:
	@echo "========================================"
	@echo "MCP Google container logs..."
	@echo "Press Ctrl+C to stop viewing logs"
	@echo "========================================"
	@echo ""
	@docker logs -f mcpgoogle-testuser

mcp-restart:
	@echo "Restarting MCP Google test container..."
	@$(MAKE) mcp-stop
	@echo ""
	@$(MAKE) mcp-test
