.PHONY: help install dev build start lint test-api-key updown logs mcp-test mcp-stop mcp-logs mcp-restart

help:
	@echo "Available commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make start        - Start production server"
	@echo "  make lint         - Run linter"
	@echo "  make updown       - Pull latest code, rebuild and restart Docker containers"
	@echo "  make logs         - View Next.js application logs from Docker container"
	@echo "  make test-api-key - Test OpenAI API key"
	@echo ""
	@echo "MCP Google Test Container:"
	@echo "  make mcp-test     - Run MCP Google test container"
	@echo "  make mcp-stop     - Stop and remove MCP Google test container"
	@echo "  make mcp-logs     - View MCP Google container logs"
	@echo "  make mcp-restart  - Restart MCP Google test container"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

lint:
	npm run lint

updown:
	@echo "========================================"
	@echo "Step 1/3: Pulling latest code from git..."
	@echo "========================================"
	git pull
	@echo ""
	@echo "========================================"
	@echo "Step 2/3: Stopping Docker containers..."
	@echo "========================================"
	docker compose down
	@echo ""
	@echo "========================================"
	@echo "Step 3/3: Building and starting Docker containers..."
	@echo "========================================"
	@echo "Next.js logs will appear below..."
	@echo "Press Ctrl+C to stop the containers"
	@echo "========================================"
	@echo ""
	docker compose up --build --force-recreate --remove-orphans -d

logs:
	@echo "========================================"
	@echo "Viewing Next.js application logs..."
	@echo "Press Ctrl+C to stop viewing logs"
	@echo "========================================"
	@echo ""
	docker compose logs -f realtime-agents

test-api-key:
	@echo "Testing OpenAI API key..."
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
