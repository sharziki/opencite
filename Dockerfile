FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_REGISTRY_ADDRESS=""
ARG VITE_CHAIN_ID="11155111"
ENV VITE_REGISTRY_ADDRESS=$VITE_REGISTRY_ADDRESS
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
RUN npm run build:web

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
