# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time configuration for Vite
# VITE_* variables are compiled into the JS bundle at build time
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (VITE_API_URL is baked into the bundle)
RUN npm run build

# Production stage
FROM nginx:alpine

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.0.0-dev
ARG SOURCE_URL=https://gitlab.com/numio-ai/numio-app
ARG IMAGE_TITLE=numio-ui

LABEL org.opencontainers.image.title="${IMAGE_TITLE}" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.vendor="Numio" \
      org.opencontainers.image.licenses="Proprietary"

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle SPA routing - redirect all requests to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
