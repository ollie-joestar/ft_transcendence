FROM node:24.14.1-alpine3.23 AS dev

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
# Source is mounted as a volume at runtime (see docker-compose.dev.yml)

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:24.14.1-alpine3.23 AS builder

WORKDIR /app

# Install deps first — separate layer for cache efficiency
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# VITE_API_URL must be an absolute path that the browser will call
# Since NGINX sits at the edge, the browser reaches backend at /api, 
# so VITE_API_URL=/api (relative-to-origin, no host needed)
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws


COPY frontend/ .
RUN npm run build          # outputs to /app/dist


# ── Stage 2: setup ──────────────────────────────────────────────────────────
# The OWASP WAF container is already at the edge; this container only
# receives traffic from it over the internal app_network.
FROM nginx:1.29.8-alpine AS production

# Remove the default vhost so our config is the only one loaded
RUN rm /etc/nginx/conf.d/default.conf

# SPA vhost: all unknown routes return index.html (React Router handles them)
COPY nginx/conf/nginx.spa.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
