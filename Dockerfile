FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build frontend with provided API URL (falls back to localhost)
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=build /app/dist ./

# Simple health endpoint for Docker healthcheck
RUN printf 'ok' > /usr/share/nginx/html/health

# Basic SPA config
RUN printf 'server {\\n  listen 80;\\n  server_name _;\\n  root /usr/share/nginx/html;\\n  include /etc/nginx/mime.types;\\n  location /health { return 200 \"ok\"; add_header Content-Type text/plain; }\\n  location / { try_files $uri /index.html; }\\n}\\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
