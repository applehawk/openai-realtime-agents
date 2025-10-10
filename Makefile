.PHONY: help install dev build start lint test-api-key

help:
	@echo "Available commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make start        - Start production server"
	@echo "  make lint         - Run linter"
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
