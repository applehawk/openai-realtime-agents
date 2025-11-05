#!/bin/bash

# Server setup script for OpenAI Realtime Agents
# This script installs Docker, Docker Compose, and Nginx on the server
# Run this ONCE on a fresh server before deploying the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Server Setup for OpenAI Realtime Agents ===${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash setup-server.sh"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update
apt-get upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

# Install basic dependencies
echo -e "${YELLOW}Installing basic dependencies...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    ufw \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Install Docker
echo -e "${YELLOW}Installing Docker...${NC}"
if command -v docker &> /dev/null; then
    echo "Docker is already installed"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Install Docker Compose
echo -e "${YELLOW}Installing Docker Compose...${NC}"
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "Docker Compose is already installed"
else
    # Install Docker Compose plugin
    apt-get install -y docker-compose-plugin
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Install Nginx
echo -e "${YELLOW}Installing Nginx...${NC}"
if command -v nginx &> /dev/null; then
    echo "Nginx is already installed"
else
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
echo -e "${GREEN}✓ Nginx installed${NC}"

# Install Certbot for SSL
echo -e "${YELLOW}Installing Certbot...${NC}"
if command -v certbot &> /dev/null; then
    echo "Certbot is already installed"
else
    apt-get install -y certbot python3-certbot-nginx
fi
echo -e "${GREEN}✓ Certbot installed${NC}"

# Setup firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Application (for testing)
echo -e "${GREEN}✓ Firewall configured${NC}"

# Setup SSH key for GitHub (if needed)
echo -e "${YELLOW}Checking SSH key for GitHub...${NC}"
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "No SSH key found. Generating one..."
    ssh-keygen -t ed25519 -C "server@rndaibot.ru" -f ~/.ssh/id_ed25519 -N ""
    echo ""
    echo -e "${YELLOW}=== IMPORTANT ===${NC}"
    echo "Add this SSH public key to your GitHub repository:"
    echo ""
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "Go to: https://github.com/applehawk/openai-realtime-agents/settings/keys"
    echo "Click 'Add deploy key' and paste the above key"
    echo ""
    read -p "Press Enter after adding the key to GitHub..."
else
    echo "SSH key already exists"
fi
echo -e "${GREEN}✓ SSH key ready${NC}"

# Test GitHub connection
echo -e "${YELLOW}Testing GitHub connection...${NC}"
ssh -T git@github.com 2>&1 | grep -q "successfully authenticated" || {
    echo -e "${YELLOW}Note: You may need to accept GitHub's fingerprint${NC}"
    echo "Run: ssh -T git@github.com"
}

# Create application directory
echo -e "${YELLOW}Creating application directory...${NC}"
mkdir -p /opt/openai-realtime-agents
echo -e "${GREEN}✓ Directory created${NC}"

# Show system information
echo ""
echo -e "${GREEN}=== Server Setup Complete ===${NC}"
echo ""
echo "Server information:"
echo "  Docker version:    $(docker --version)"
echo "  Compose version:   $(docker compose version 2>/dev/null || docker-compose --version)"
echo "  Nginx version:     $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "  Certbot version:   $(certbot --version 2>&1 | cut -d' ' -f2)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Add the SSH key to GitHub (shown above)"
echo "  2. Run the deployment script from your local machine:"
echo "     ./deploy.sh"
echo "  3. Configure nginx and SSL certificate"
echo ""
