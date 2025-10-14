# Deployment Guide

This guide explains how to deploy the OpenAI Realtime Agents application using Docker and nginx on your server.

## Server Information

- **Domain**: https://rndaibot.ru/
- **Server IP**: 79.132.139.57
- **Application Port**: 3000

## Prerequisites

On your server, you need:
- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Nginx
- SSL certificate (Let's Encrypt recommended)

## Setup Instructions

### 1. Prepare Environment Variables

Copy the sample environment file and configure it:

```bash
cp .env.sample .env
nano .env
```

Update the following variables in `.env`:
- `OPENAI_API_KEY`: Your OpenAI API key
- `NEXT_PUBLIC_AUTH_API_URL`: Your auth API URL (currently: http://79.132.139.57:7000/api/v1)

### 2. Build and Run with Docker

Build the Docker image:
```bash
docker-compose build
```

Start the application:
```bash
docker-compose up -d
```

Check the logs:
```bash
docker-compose logs -f
```

Stop the application:
```bash
docker-compose down
```

### 3. Configure Nginx

#### Install Nginx (if not already installed)
```bash
sudo apt update
sudo apt install nginx
```

#### Setup SSL Certificate with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d rndaibot.ru -d www.rndaibot.ru
```

#### Configure Nginx
Copy the example nginx configuration:
```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/rndaibot.ru
```

Update the SSL certificate paths in the configuration if needed:
```bash
sudo nano /etc/nginx/sites-available/rndaibot.ru
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rndaibot.ru /etc/nginx/sites-enabled/
```

Test the configuration:
```bash
sudo nginx -t
```

Reload nginx:
```bash
sudo systemctl reload nginx
```

### 4. Verify Deployment

Check if the application is running:
```bash
curl http://localhost:3000/api/health
```

Check if nginx is working:
```bash
curl https://rndaibot.ru/api/health
```

## Docker Commands

### View running containers
```bash
docker ps
```

### View logs
```bash
docker-compose logs -f realtime-agents
```

### Restart application
```bash
docker-compose restart
```

### Rebuild after code changes
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Remove all containers and volumes
```bash
docker-compose down -v
```

## Updating the Application

1. Pull the latest code:
```bash
git pull origin main
```

2. Rebuild and restart:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Check application logs
```bash
docker-compose logs -f
```

### Check nginx logs
```bash
sudo tail -f /var/log/nginx/rndaibot_error.log
sudo tail -f /var/log/nginx/rndaibot_access.log
```

### Application not accessible
1. Check if Docker container is running: `docker ps`
2. Check if the port is accessible: `curl http://localhost:3000/api/health`
3. Check nginx configuration: `sudo nginx -t`
4. Check firewall rules: `sudo ufw status`

### WebSocket connections failing
Ensure nginx is properly configured for WebSocket support. The `nginx.conf.example` includes the necessary WebSocket configuration.

### SSL certificate renewal
Let's Encrypt certificates expire after 90 days. To renew:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Performance Optimization

### Enable nginx caching
The provided nginx configuration includes caching for static files.

### Docker resource limits
You can add resource limits in `docker-compose.yml`:
```yaml
services:
  realtime-agents:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          memory: 512M
```

## Security Recommendations

1. Keep Docker and system packages updated
2. Use strong SSL/TLS configuration (included in nginx.conf.example)
3. Regularly rotate your `OPENAI_API_KEY`
4. Use environment variables, never commit secrets to git
5. Set up a firewall (ufw) to restrict access to necessary ports only:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

## Monitoring

### Health check endpoint
The application includes a health check at `/api/health` which can be used for monitoring.

### Docker health status
```bash
docker inspect --format='{{.State.Health.Status}}' openai-realtime-agents
```

### Set up automatic restarts
Docker Compose is configured with `restart: unless-stopped` to automatically restart the container if it crashes.

## Backup

### Backup environment variables
```bash
cp .env .env.backup
```

## Support

For issues with:
- The application: Check the GitHub repository
- Docker: https://docs.docker.com/
- Nginx: https://nginx.org/en/docs/
- Let's Encrypt: https://letsencrypt.org/docs/
