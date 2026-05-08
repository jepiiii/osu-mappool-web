docker rm mappool
docker run -d -p 5000:5000 --env-file .env --name mappool --restart unless-stopped osu-mappool-web
