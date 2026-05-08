#!/bin/bash
set -e

cd /home/kaiapi/osu-mappool-web || exit

echo "Pulling latest code..."
git pull origin main

echo "Building image..."
docker build -t osu-mappool-web .

echo "Stopping old container..."
docker stop mappool || true
docker rm mappool || true

echo "Starting container with auto-start..."
docker run -d \
  -p 5000:5000 \
  --env-file .env \
  --name mappool \
  --restart unless-stopped \
  osu-mappool-web

echo "Deployment complete!"
