# Use official Node.js image as base
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (for Docker layer caching)
# If package.json hasn't changed, Docker skips npm install on rebuild
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of source code
COPY . .

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "src/index.js"]
