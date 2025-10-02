FROM node:20-alpine
WORKDIR /app
RUN corepack enable

# Use root lockfile + workspace layout for reproducible installs
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# cache package graphs for the specific workspaces you need
COPY apps/hub/package.json apps/hub/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# bring in all sources (hub + shared)
COPY . .

# IMPORTANT: run from the app folder
WORKDIR /app/apps/hub
EXPOSE 5173
CMD ["pnpm","dev","--host","0.0.0.0","--port","5173","--strictPort"]
