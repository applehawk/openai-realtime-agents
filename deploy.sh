#!/bin/bash

# Deployment script for OpenAI Realtime Agents
# Server: 79.132.139.57
# Domain: https://rndaibot.ru/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="79.132.139.57"
SERVER_USER="root"
APP_DIR="/opt/openai-realtime-agents"
REPO_URL="git@github.com:applehawk/openai-realtime-agents.git"
BRANCH="main"

echo -e "${GREEN}=== OpenAI Realtime Agents Deployment ===${NC}"
echo ""

# Function to run commands on server
run_on_server() {
    ssh -t "${SERVER_USER}@${SERVER_IP}" "$1"
}

# Check SSH connection
echo -e "${YELLOW}Checking SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 "${SERVER_USER}@${SERVER_IP}" "exit" 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to server${NC}"
    echo "Please ensure:"
    echo "  1. You have SSH access to ${SERVER_USER}@${SERVER_IP}"
    echo "  2. Your SSH key is added to the server"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"

# Check if Docker is installed on server
echo -e "${YELLOW}Checking Docker installation...${NC}"
if ! run_on_server "command -v docker" > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not installed on the server${NC}"
    echo "Please install Docker first:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed${NC}"

# Check if Docker Compose is installed
echo -e "${YELLOW}Checking Docker Compose installation...${NC}"
if ! run_on_server "command -v docker-compose" > /dev/null 2>&1 && ! run_on_server "docker compose version" > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker Compose is not installed on the server${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is installed${NC}"

# Create application directory
echo -e "${YELLOW}Creating application directory...${NC}"
run_on_server "mkdir -p ${APP_DIR}"
echo -e "${GREEN}✓ Directory created${NC}"

# Clone or update repository
echo -e "${YELLOW}Deploying code from GitHub...${NC}"
run_on_server "
    cd ${APP_DIR}
    if [ -d .git ]; then
        echo 'Repository exists, pulling latest changes...'
        git fetch origin
        git reset --hard origin/${BRANCH}
        git pull origin ${BRANCH}
    else
        echo 'Cloning repository...'
        git clone ${REPO_URL} .
        git checkout ${BRANCH}
    fi
"
echo -e "${GREEN}✓ Code deployed${NC}"

# Check if .env file exists
echo -e "${YELLOW}Checking environment configuration...${NC}"
if ! run_on_server "test -f ${APP_DIR}/.env" > /dev/null 2>&1; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from .env.sample..."
    run_on_server "cp ${APP_DIR}/.env.sample ${APP_DIR}/.env"
    echo -e "${RED}⚠ IMPORTANT: Please edit ${APP_DIR}/.env on the server and add your OPENAI_API_KEY${NC}"
    echo ""
    read -p "Press Enter to continue after you've configured .env..."
fi
echo -e "${GREEN}✓ Environment file exists${NC}"

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
run_on_server "cd ${APP_DIR} && docker-compose build"
echo -e "${GREEN}✓ Docker image built${NC}"

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
run_on_server "cd ${APP_DIR} && docker-compose down" || true
echo -e "${GREEN}✓ Containers stopped${NC}"

# Start containers
echo -e "${YELLOW}Starting application...${NC}"
run_on_server "cd ${APP_DIR} && docker-compose up -d"
echo -e "${GREEN}✓ Application started${NC}"

# Wait for health check
echo -e "${YELLOW}Waiting for application to be ready...${NC}"
sleep 10

# Check if application is running
if run_on_server "curl -f http://localhost:3000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is healthy${NC}"
else
    echo -e "${RED}Warning: Health check failed${NC}"
    echo "Check logs with: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${APP_DIR} && docker-compose logs'"
fi

# Show container status
echo ""
echo -e "${YELLOW}Container status:${NC}"
run_on_server "cd ${APP_DIR} && docker-compose ps"

# Show logs tail
echo ""
echo -e "${YELLOW}Recent logs:${NC}"
run_on_server "cd ${APP_DIR} && docker-compose logs --tail=20"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Application is deployed at: http://${SERVER_IP}:3000"
echo ""
echo "Useful commands:"
echo "  View logs:       ssh ${SERVER_USER}@${SERVER_IP} 'cd ${APP_DIR} && docker-compose logs -f'"
echo "  Restart:         ssh ${SERVER_USER}@${SERVER_IP} 'cd ${APP_DIR} && docker-compose restart'"
echo "  Stop:            ssh ${SERVER_USER}@${SERVER_IP} 'cd ${APP_DIR} && docker-compose down'"
echo "  Rebuild:         ssh ${SERVER_USER}@${SERVER_IP} 'cd ${APP_DIR} && docker-compose up -d --build'"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Configure nginx reverse proxy (see nginx.conf.example)"
echo "  2. Setup SSL certificate with Let's Encrypt"
echo "  3. Access your application at https://rndaibot.ru/"
echo ""
