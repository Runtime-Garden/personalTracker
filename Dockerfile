# Install dev/build dependencies, compile both applications, then ship only runtime assets.
FROM node:22.16.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Reproducible install from the reviewed lockfile.
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json ./
COPY apps ./apps
RUN npm run build

FROM node:22.16.0-bookworm-slim AS runner
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/api/server.js"]
