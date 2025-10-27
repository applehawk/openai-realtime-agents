#!/bin/bash

# Deployment Troubleshooting Script
# This script helps diagnose environment variable issues in production

echo "=========================================="
echo "OpenAI Realtime Agents - Deployment Check"
echo "=========================================="
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "✅ .env file exists"
    
    # Check if OPENAI_API_KEY is set in .env
    if grep -q "^OPENAI_API_KEY=" .env; then
        echo "✅ OPENAI_API_KEY is defined in .env"
        
        # Get the key (masked for security)
        KEY_VALUE=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        KEY_LENGTH=${#KEY_VALUE}
        
        if [ $KEY_LENGTH -gt 0 ]; then
            echo "✅ OPENAI_API_KEY has value (length: $KEY_LENGTH)"
            echo "   Prefix: ${KEY_VALUE:0:7}..."
        else
            echo "❌ OPENAI_API_KEY is empty!"
        fi
    else
        echo "❌ OPENAI_API_KEY not found in .env file!"
    fi
else
    echo "❌ .env file not found!"
    echo "   Please create .env file with OPENAI_API_KEY"
    exit 1
fi

echo ""
echo "=========================================="
echo "Docker Compose Configuration Check"
echo "=========================================="
echo ""

# Check if docker-compose.yml exists
if [ -f docker-compose.yml ]; then
    echo "✅ docker-compose.yml exists"
    
    # Check if OPENAI_API_KEY is in environment section
    if grep -q "OPENAI_API_KEY" docker-compose.yml; then
        echo "✅ OPENAI_API_KEY is referenced in docker-compose.yml"
    else
        echo "⚠️  OPENAI_API_KEY not found in docker-compose.yml"
    fi
else
    echo "❌ docker-compose.yml not found!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Container Environment Check"
echo "=========================================="
echo ""

# Check if container is running
if docker ps | grep -q "openai-realtime-agents"; then
    echo "✅ Container is running"
    
    # Check environment variables inside container
    echo ""
    echo "Checking environment variables inside container:"
    
    KEY_SET=$(docker exec openai-realtime-agents sh -c 'if [ -n "$OPENAI_API_KEY" ]; then echo "yes"; else echo "no"; fi')
    
    if [ "$KEY_SET" = "yes" ]; then
        echo "✅ OPENAI_API_KEY is set inside container"
        
        KEY_LENGTH=$(docker exec openai-realtime-agents sh -c 'echo ${#OPENAI_API_KEY}')
        KEY_PREFIX=$(docker exec openai-realtime-agents sh -c 'echo $OPENAI_API_KEY | cut -c1-7')
        
        echo "   Length: $KEY_LENGTH"
        echo "   Prefix: $KEY_PREFIX..."
    else
        echo "❌ OPENAI_API_KEY is NOT set inside container!"
        echo "   This is the root cause of the 401 error."
    fi
    
    echo ""
    echo "Other environment variables:"
    docker exec openai-realtime-agents sh -c 'echo "NODE_ENV: $NODE_ENV"'
    docker exec openai-realtime-agents sh -c 'echo "RAG_SERVER_URL: $RAG_SERVER_URL"'
    docker exec openai-realtime-agents sh -c 'echo "RAG_API_BASE_URL: $RAG_API_BASE_URL"'
else
    echo "❌ Container is not running!"
    echo "   Start the container with: docker-compose up -d"
fi

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "If OPENAI_API_KEY is not set in container:"
echo "1. Stop the container: docker-compose down"
echo "2. Verify .env file has correct API key"
echo "3. Rebuild and restart: docker-compose up -d --build"
echo "4. Check logs: docker-compose logs -f"
echo "5. Test health endpoint: curl http://localhost:3000/api/health-env"
echo ""
echo "If issues persist, check:"
echo "- API key is valid at https://platform.openai.com/api-keys"
echo "- No extra spaces or quotes in .env file"
echo "- .env file encoding is UTF-8"
echo ""

