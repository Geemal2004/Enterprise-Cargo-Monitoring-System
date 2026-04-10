# Step 1: Build the React Application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install

# Build arguments mapped to Vite ENV variables
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copy source and build
COPY . .
RUN npm run build

# Step 2: Serve via Nginx
FROM nginx:alpine

# Clear default html
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
