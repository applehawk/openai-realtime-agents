# Quick Deployment Guide

Deploy your application from GitHub to https://rndaibot.ru/ in 3 steps.

## Step 1: Setup Server (One-time)

SSH into your server and run:

```bash
ssh root@79.132.139.57
wget https://raw.githubusercontent.com/applehawk/openai-realtime-agents/main/setup-server.sh
chmod +x setup-server.sh
sudo ./setup-server.sh
```

After the script completes:
1. Copy the SSH public key displayed in the terminal
2. Add it to GitHub: https://github.com/applehawk/openai-realtime-agents/settings/keys
3. Click "Add deploy key", paste the key, and give it write access (optional)

## Step 2: Deploy Application

From your **local machine**, run:

```bash
./deploy.sh
```

When prompted, configure your `.env` file on the server with:
- Your `OPENAI_API_KEY`
- Auth API URL (default: http://79.132.139.57:7000/api/v1)

## Step 3: Setup Nginx & SSL

SSH into your server:

```bash
ssh root@79.132.139.57
cd /opt/openai-realtime-agents

# Configure nginx
cp nginx.conf.example /etc/nginx/sites-available/rndaibot.ru
ln -s /etc/nginx/sites-available/rndaibot.ru /etc/nginx/sites-enabled/

# Get SSL certificate
certbot certonly --nginx -d rndaibot.ru -d www.rndaibot.ru

# Apply configuration
nginx -t && systemctl reload nginx
```

## Done!

Your application is now live at: **https://rndaibot.ru/**

## Useful Commands

### Deploy updates (from local machine)
```bash
./deploy.sh
```

### View logs (on server)
```bash
ssh root@79.132.139.57 'cd /opt/openai-realtime-agents && docker-compose logs -f'
```

### Restart application (on server)
```bash
ssh root@79.132.139.57 'cd /opt/openai-realtime-agents && docker-compose restart'
```

### Check status (on server)
```bash
ssh root@79.132.139.57 'cd /opt/openai-realtime-agents && docker-compose ps'
```

## Troubleshooting

### Can't connect to GitHub
Run on server: `ssh -T git@github.com`
If it fails, check that your deploy key is added to GitHub.

### Application won't start
Check logs: `docker-compose logs -f`
Common issues:
- Missing `OPENAI_API_KEY` in `.env`
- Port 3000 already in use
- Docker not running

### Can't access via HTTPS
1. Check nginx: `sudo nginx -t`
2. Check SSL certificate: `sudo certbot certificates`
3. Check firewall: `sudo ufw status`

For detailed troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).
