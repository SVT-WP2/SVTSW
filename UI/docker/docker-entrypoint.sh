#!/bin/sh
set -e

# Substitute environment variables into nginx config
envsubst '${SVT_UI_PORT} ${SVT_UI_API_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "Starting NestJS API on port ${SVT_UI_API_PORT}..."
cd /app/api
node main.js &

echo "Starting nginx on port ${SVT_UI_PORT}..."
nginx -g 'daemon off;'

