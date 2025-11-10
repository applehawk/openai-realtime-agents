#!/bin/bash
# Скрипт для получения SSL сертификата Let's Encrypt для dev домена

set -e

echo "=========================================="
echo "Настройка SSL сертификата для dev домена"
echo "=========================================="
echo ""

# Проверка наличия certbot
if ! command -v certbot &> /dev/null; then
    echo "Установка certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "Получение сертификата для rndaibotdev.ru..."
echo ""

# Остановка nginx контейнера временно для получения сертификата
echo "Остановка nginx контейнера..."
docker compose -f docker-compose.nginx.yml stop nginx || true

# Получение сертификата через standalone режим
sudo certbot certonly --standalone \
    -d rndaibotdev.ru \
    -d www.rndaibotdev.ru \
    --email admin@rndaibot.ru \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

echo ""
echo "Сертификат получен!"
echo ""
echo "Копирование сертификата в директорию nginx..."
sudo cp /etc/letsencrypt/live/rndaibotdev.ru/fullchain.pem /etc/nginx/ssl/rndaibotdev.crt
sudo cp /etc/letsencrypt/live/rndaibotdev.ru/privkey.pem /etc/nginx/ssl/rndaibotdev.key
sudo chmod 644 /etc/nginx/ssl/rndaibotdev.crt
sudo chmod 600 /etc/nginx/ssl/rndaibotdev.key

echo ""
echo "Обновление конфигурации nginx..."
# Обновить rndaibotdev.conf для использования Let's Encrypt сертификата
sed -i 's|ssl_certificate /etc/nginx/ssl/rndaibot.crt;|ssl_certificate /etc/nginx/ssl/rndaibotdev.crt;|' /home/kravtandr/oma-frontend/rndaibotdev.conf
sed -i 's|ssl_certificate_key /etc/nginx/ssl/rndaibot.key;|ssl_certificate_key /etc/nginx/ssl/rndaibotdev.key;|' /home/kravtandr/oma-frontend/rndaibotdev.conf

echo "Запуск nginx контейнера..."
docker compose -f docker-compose.nginx.yml start nginx

echo ""
echo "=========================================="
echo "SSL сертификат настроен!"
echo "=========================================="
echo ""
echo "Для автоматического обновления сертификата добавьте в crontab:"
echo "0 0 * * * certbot renew --quiet && docker compose -f /home/kravtandr/oma-frontend/docker-compose.nginx.yml exec nginx nginx -s reload"
echo ""

