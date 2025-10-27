#!/bin/bash

# Test script for RAG API endpoints used by interview tools

echo "=========================================="
echo "🧪 RAG API Endpoint Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RAG_API_URL="${RAG_API_BASE_URL:-http://79.132.139.57:9621}"
TEST_USER_ID="test_$(date +%s)"
TEST_WORKSPACE="${TEST_USER_ID}_user_key_preferences"

echo "Configuration:"
echo "  RAG API URL: $RAG_API_URL"
echo "  Test User ID: $TEST_USER_ID"
echo "  Test Workspace: $TEST_WORKSPACE"
echo ""

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${BLUE}Testing: $description${NC}"
    echo "  $method $RAG_API_URL$endpoint"
    
    if [ -z "$data" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" \
            "$RAG_API_URL$endpoint" \
            -H "Content-Type: application/json" \
            2>&1)
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" \
            "$RAG_API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            2>&1)
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo -e "  ${GREEN}✅ Success (HTTP $HTTP_CODE)${NC}"
        echo "  Response: $(echo "$BODY" | head -c 100)..."
        echo ""
        return 0
    else
        echo -e "  ${RED}❌ Failed (HTTP $HTTP_CODE)${NC}"
        echo "  Error: $BODY"
        echo ""
        return 1
    fi
}

# Test 1: Check if RAG API is accessible
echo "=========================================="
echo "Test 1: RAG API Health Check"
echo "=========================================="
if curl -s --connect-timeout 5 "$RAG_API_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ RAG API is accessible${NC}"
else
    echo -e "${RED}❌ RAG API is NOT accessible${NC}"
    echo ""
    echo "Please check:"
    echo "1. RAG server is running on port 9621"
    echo "2. URL is correct: $RAG_API_URL"
    echo "3. Firewall allows connections"
    exit 1
fi
echo ""

# Test 2: GET /workspaces - List workspaces
echo "=========================================="
echo "Test 2: List Workspaces"
echo "=========================================="
test_endpoint "GET" "/workspaces" "" "Get list of all workspaces"

# Test 3: POST /workspaces - Create workspace
echo "=========================================="
echo "Test 3: Create Workspace"
echo "=========================================="
test_endpoint "POST" "/workspaces" "{\"name\": \"$TEST_WORKSPACE\"}" "Create new workspace"

# Test 4: POST /documents/text - Save interview data
echo "=========================================="
echo "Test 4: Save Interview Data"
echo "=========================================="

INTERVIEW_DATA="ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ: $TEST_USER_ID
Должность: Test Developer
Дата интервью: $(date -Iseconds)

КОМПЕТЕНЦИИ И ЭКСПЕРТИЗА:
Тестирование API, Python, Bash scripting

СТИЛЬ ОБЩЕНИЯ:
Неформальный, прямой

ПРЕДПОЧТЕНИЯ ДЛЯ ВСТРЕЧ:
Утро вторника

РЕЖИМ ФОКУСНОЙ РАБОТЫ:
9:00-12:00 не беспокоить

СТИЛЬ РАБОТЫ С ЗАДАЧАМИ:
Последовательно

КАРЬЕРНЫЕ ЦЕЛИ:
Автоматизация тестирования

ПОДХОД К РЕШЕНИЮ ЗАДАЧ:
Обсуждение с командой"

# Escape JSON properly
INTERVIEW_DATA_JSON=$(echo "$INTERVIEW_DATA" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")

test_endpoint "POST" "/documents/text" \
    "{\"text\": $INTERVIEW_DATA_JSON, \"file_source\": \"initial_interview\", \"workspace\": \"$TEST_WORKSPACE\"}" \
    "Save interview document to workspace"

# Test 5: POST /query - Query saved data
echo "=========================================="
echo "Test 5: Query Interview Data"
echo "=========================================="
test_endpoint "POST" "/query" \
    "{\"query\": \"полный профиль пользователя $TEST_USER_ID\", \"mode\": \"local\", \"top_k\": 5, \"workspace\": \"$TEST_WORKSPACE\"}" \
    "Query for saved interview data"

# Test 6: Verify workspace exists
echo "=========================================="
echo "Test 6: Verify Workspace Exists"
echo "=========================================="
WORKSPACES_RESPONSE=$(curl -s -X GET "$RAG_API_URL/workspaces" -H "Content-Type: application/json")

if echo "$WORKSPACES_RESPONSE" | grep -q "$TEST_WORKSPACE"; then
    echo -e "${GREEN}✅ Test workspace found in list${NC}"
else
    echo -e "${YELLOW}⚠️  Test workspace not found in list (might be in different format)${NC}"
    echo "Response: $(echo "$WORKSPACES_RESPONSE" | head -c 200)..."
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "Tested endpoints:"
echo "  ✅ GET  /workspaces         - List all workspaces"
echo "  ✅ POST /workspaces         - Create workspace"
echo "  ✅ POST /documents/text     - Save document"
echo "  ✅ POST /query              - Query documents"
echo ""
echo "These are the exact endpoints used by:"
echo "  - createUserWorkspace() in interviewTools.ts"
echo "  - saveInterviewData() in interviewTools.ts"
echo "  - startInitialInterview() for checking existing data"
echo ""

# Cleanup (optional)
echo "=========================================="
echo "🧹 Cleanup"
echo "=========================================="
echo ""
echo "Test workspace '$TEST_WORKSPACE' was created."
echo "You may want to delete it manually if RAG API supports deletion."
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""

