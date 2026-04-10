FROM node:20-slim AS builder

WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration template for dynamic environment variable substitution
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Expose port (Nginx default is 80)
EXPOSE 80

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
