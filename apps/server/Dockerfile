# Use Node.js LTS image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install -g pnpm
RUN pnpm install

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]
