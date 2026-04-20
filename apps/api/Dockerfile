# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN npm ci --workspace=apps/api

# ── Development ───────────────────────────────────────────────────────────────
FROM deps AS development
COPY apps/api/ ./apps/api/
RUN cd apps/api && npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=apps/api"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/api/ ./apps/api/
RUN cd apps/api && npx prisma generate && npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 axon \
 && chown -R axon:nodejs /app
USER axon

EXPOSE 3001
CMD ["node", "dist/server.js"]
