# Use Node.js image (we may add frontend build later)
FROM node:20

WORKDIR /app

# Copy package files
COPY . .

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install || echo "Dependencies not installed yet"

# Copy source code (optional for now)
COPY . .

# Expose a placeholder port (change later if needed)
EXPOSE 3000

# Default command (keeps container alive)
CMD ["tail", "-f", "/dev/null"]
