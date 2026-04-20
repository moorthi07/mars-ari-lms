# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/ ./packages/

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN npm ci --workspace=apps/web

# ── Development ───────────────────────────────────────────────────────────────
FROM deps AS development
COPY apps/web/ ./apps/web/
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/web"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/web/ ./apps/web/
ARG VITE_API_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
RUN npm run build --workspace=apps/web

# ── Production (nginx) ────────────────────────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
