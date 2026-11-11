# Один контейнер отдаёт и API под /api, и собранную статику SPA (ADR-0002).
# Сборка многоступенчатая: в финальный образ попадают только
# производственные зависимости API, скомпилированный NestJS и билд
# фронтенда — без монорепозитория и инструментов сборки.
FROM node:22-alpine AS build
WORKDIR /workspace

# pnpm строго той версии, что закреплена в package.json (packageManager).
RUN npm install --global pnpm@12.18.0

# Сначала только манифесты: слой зависимостей кэшируется, пока они не меняются.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/e2e/package.json apps/e2e/
COPY packages/contract/package.json packages/contract/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile

# Теперь исходники и сборка всего монорепозитория: контракт, SDK, веб и API.
COPY . .
RUN pnpm build

# pnpm deploy выносит @repo/api в самостоятельный каталог: производственные
# зависимости копируются файлами, без симлинков в общий store.
RUN pnpm --filter @repo/api deploy --prod --legacy /deploy

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/package.json ./package.json
COPY --from=build /workspace/apps/api/dist ./dist
# Статика SPA лежит рядом с main.js — API находит её по умолчанию (ADR-0002).
COPY --from=build /workspace/apps/web/dist ./dist/web

# API и статика не требуют привилегий: слушаем непривилегированный порт
# 3000 и работаем от готового пользователя node.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
