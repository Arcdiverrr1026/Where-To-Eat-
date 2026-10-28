FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace backend --no-audit --no-fund
COPY backend backend
USER node
EXPOSE 3001
CMD ["node", "backend/src/server.js"]
