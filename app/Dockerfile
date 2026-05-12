# Production SPA: nginx serves Vite output on 80 and 8080 (Dokploy/Traefik often targets 80 for nginx images).

FROM node:22-alpine AS build
WORKDIR /app

# Optional build-args; if unset, Vite reads the same keys from copied `.env`.
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN set -e; \
  if [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then export VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"; fi; \
  if [ -n "$VITE_SUPABASE_URL" ]; then export VITE_SUPABASE_URL="$VITE_SUPABASE_URL"; fi; \
  npm run build

FROM nginx:stable-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 8080
