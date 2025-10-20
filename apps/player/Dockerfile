FROM node:20-alpine
WORKDIR /app
RUN corepack enable

ENV PATH="/app/node_modules/.bin:$PATH"

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/player/package.json apps/player/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/apps/player
EXPOSE 5173
CMD ["pnpm","dev","--host","0.0.0.0","--port","5173","--strictPort"]
