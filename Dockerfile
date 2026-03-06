FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm i @sveltejs/adapter-node
COPY . .
COPY svelte.config.docker.js svelte.config.js
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
RUN npm ci --omit dev

EXPOSE 3000
ENV PORT=3000
ENV ORIGIN=http://localhost
CMD ["node", "build"]
