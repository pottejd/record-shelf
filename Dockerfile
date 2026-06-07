FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build with the adapter-node target (selected by svelte.config.js).
ENV ADAPTER=node
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# ADAPTER=node enables the runtime env validation in hooks.server.ts.
ENV ADAPTER=node

COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
RUN npm ci --omit dev

EXPOSE 3000
ENV PORT=3000
# Set ORIGIN to the real https URL at deploy time (docker run -e ORIGIN=...).
ENV ORIGIN=http://localhost
CMD ["node", "build"]
