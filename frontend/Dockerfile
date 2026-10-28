FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace frontend --include=dev --no-audit --no-fund
COPY frontend frontend
ARG APP_BASE=/
RUN npm run build --workspace frontend -- --base=$APP_BASE
FROM nginx:1.28-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
