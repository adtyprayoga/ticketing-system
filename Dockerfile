# Production images for Coolify (compose.coolify.yaml). Build one target at a time:
#   docker build --target api .   |   docker build --target web .
FROM node:26-alpine AS manifests
WORKDIR /app
# npm ci checks every workspace against the lockfile, so all workspace manifests come along.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM manifests AS api
ENV NODE_ENV=production
RUN npm ci --omit=dev -w @ticketing/api && npm cache clean --force
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/src apps/api/src
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# TypeScript runs natively on Node 26. Migrations and the seed are idempotent, so every start runs them.
CMD ["sh", "-c", "node src/db/migrate-cli.ts && node src/db/seed.ts && exec node src/server.ts"]

FROM manifests AS web
RUN npm ci -w @ticketing/web && npm cache clean --force
COPY apps/web apps/web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# next start writes its cache under .next, so the node user owns it.
RUN npm run build -w apps/web && chown -R node:node apps/web/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]
