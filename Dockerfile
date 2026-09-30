# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# 1. Dependências
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
RUN npm ci

# 2. Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy URL para que o build estático e geração do Prisma Client ocorram normalmente
ENV DATABASE_URL="postgresql://build_user:build_pass@localhost:5432/build_db?schema=public"

# Configurar schema do Prisma para PostgreSQL e gerar client
RUN node scripts/switch-database.js postgres && npx prisma generate
RUN npm run build

# 3. Runner de Produção
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
