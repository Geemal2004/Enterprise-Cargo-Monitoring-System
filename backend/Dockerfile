FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY . .

EXPOSE 5000

# Start server
CMD ["npm", "start"]
