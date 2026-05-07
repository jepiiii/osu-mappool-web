#!/bin/bash

cd /home/kaiapi/osu-mappool-web || exit

echo "Pulling latest code..."
git pull origin main

echo "Stopping container..."
docker stop mappool || true
docker rm mappool || true

echo "Building image..."
docker build -t osu-mappool-web .

echo "Starting container..."
docker run -d -p 5000:5000 --name mappool osu-mappool-web

echo "Deployment complete!"
