.PHONY: help install dev build start lint test-api-key updown logs

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
	docker compose up --build --force-recreate --remove-orphans

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
