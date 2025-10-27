#!/bin/bash

# Quick Production Fix Script
# Run this on your production server to fix the 401 error

set -e  # Exit on error

echo "=========================================="
echo "🔧 OpenAI Realtime Agents - Quick Fix"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo ""
    echo "Please create .env file with your OpenAI API key:"
    echo ""
    echo "cat > .env << 'EOF'"
    echo 'OPENAI_API_KEY="sk-proj-YOUR_NEW_KEY_HERE"'
    echo 'NEXT_PUBLIC_AUTH_API_URL=https://rndaibot.ru/apib/v1/'
    echo 'NODE_ENV=production'
    echo 'PORT=3000'
    echo 'HOSTNAME=0.0.0.0'
    echo 'RAG_SERVER_URL=http://79.132.139.57:8000/mcp'
    echo 'RAG_API_BASE_URL=http://79.132.139.57:9621'
    echo 'RAG_API_TIMEOUT=60000'
    echo 'RAG_API_RETRY_ATTEMPTS=5'
    echo 'ALLOWED_ORIGINS=https://rndaibot.ru'
    echo 'NODE_TLS_REJECT_UNAUTHORIZED=0'
    echo "EOF"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Check if OPENAI_API_KEY is set
if ! grep -q "^OPENAI_API_KEY=" .env; then
    echo -e "${RED}❌ OPENAI_API_KEY not found in .env!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ OPENAI_API_KEY is defined${NC}"
echo ""

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Backed up .env file${NC}"
echo ""

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down
echo ""

# Remove old images (optional)
echo "🗑️  Removing old images..."
docker rmi openai-realtime-agents-realtime-agents 2>/dev/null || true
echo ""

# Build with no cache
echo "🏗️  Building new image (this may take a few minutes)..."
docker-compose build --no-cache
echo ""

# Start containers
echo "🚀 Starting containers..."
docker-compose up -d
echo ""

# Wait for container to be ready
echo "⏳ Waiting for container to start..."
sleep 5

# Check if container is running
if docker ps | grep -q "openai-realtime-agents"; then
    echo -e "${GREEN}✅ Container is running${NC}"
    echo ""
    
    # Check environment variables
    echo "🔍 Checking environment variables in container..."
    KEY_SET=$(docker exec openai-realtime-agents sh -c 'if [ -n "$OPENAI_API_KEY" ]; then echo "yes"; else echo "no"; fi' 2>/dev/null || echo "error")
    
    if [ "$KEY_SET" = "yes" ]; then
        echo -e "${GREEN}✅ OPENAI_API_KEY is set in container${NC}"
        
        KEY_LENGTH=$(docker exec openai-realtime-agents sh -c 'echo ${#OPENAI_API_KEY}' 2>/dev/null)
        KEY_PREFIX=$(docker exec openai-realtime-agents sh -c 'echo $OPENAI_API_KEY | cut -c1-7' 2>/dev/null)
        
        echo "   Length: $KEY_LENGTH"
        echo "   Prefix: $KEY_PREFIX..."
        echo ""
    else
        echo -e "${RED}❌ OPENAI_API_KEY is NOT set in container${NC}"
        echo "   Check docker-compose logs for details"
        echo ""
    fi
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo "   Check logs with: docker-compose logs"
    exit 1
fi

# Test health endpoint
echo "🏥 Testing health endpoint..."
sleep 2
HEALTH_CHECK=$(curl -s http://localhost:3000/api/health-env 2>/dev/null || echo "failed")

if [ "$HEALTH_CHECK" != "failed" ]; then
    echo -e "${GREEN}✅ Health endpoint is responding${NC}"
    echo ""
    echo "Response:"
    echo "$HEALTH_CHECK" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_CHECK"
    echo ""
else
    echo -e "${YELLOW}⚠️  Health endpoint not ready yet${NC}"
    echo "   Try: curl http://localhost:3000/api/health-env"
    echo ""
fi

# Show logs
echo "=========================================="
echo "📋 Recent Logs (last 20 lines):"
echo "=========================================="
docker-compose logs --tail=20

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check health: curl http://localhost:3000/api/health-env"
echo "2. View logs: docker-compose logs -f"
echo "3. Test interview validation"
echo ""
echo "If issues persist, run: ./deploy-troubleshoot.sh"
echo ""

