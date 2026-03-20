# Stage 1: Build the React app
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build for production — outputs to /app/dist
RUN npm run build

# Stage 2: Serve with nginx
# We don't need Node.js to serve static files in production
FROM nginx:alpine

# Copy built files to nginx's serving directory
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
