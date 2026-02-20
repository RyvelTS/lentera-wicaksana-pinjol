FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Run as non-root user
USER node

# Start application
CMD ["node", "index.js"]
