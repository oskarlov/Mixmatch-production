# apps/server/Dockerfile
FROM node:20-alpine
WORKDIR /app
RUN corepack enable

# Copy workspace manifests
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Copy the specific package.json files for better install caching
COPY apps/server/package.json apps/server/package.json
# If server imports from shared, include its manifest too
COPY packages/shared/package.json packages/shared/package.json

# Install only server + its deps using the root lockfile
RUN pnpm install --frozen-lockfile --filter ./apps/server...

# Now bring in the full source
COPY . .

# Run from the server app folder
WORKDIR /app/apps/server
EXPOSE 8080
CMD ["pnpm", "start"]
