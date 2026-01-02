# syntax=docker/dockerfile:1
FROM node:20-slim AS base

FROM base AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the project
RUN npm run build

FROM base

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN groupadd -r skillz && useradd --no-log-init -r -g skillz skillz

# Create skills directory
RUN mkdir -p /home/skillz/.skillz && chown -R skillz:skillz /home/skillz

# Change ownership
RUN chown -R skillz:skillz /app

# Switch to non-root user
USER skillz

# Expose port (default is 8000 for HTTP transport)
EXPOSE 8000

# Run the Skillz MCP server, allow arguments to be passed at runtime
ENTRYPOINT ["node", "dist/cli.js"]
# No CMD, so arguments can be passed via docker run
