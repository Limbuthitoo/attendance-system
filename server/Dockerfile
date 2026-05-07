FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy application code
COPY . .

# Generate Prisma client from schema
RUN npx prisma generate

# Create data directories
RUN mkdir -p data/apk data/branding

EXPOSE 3001

# Sync schema then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/seed.js && node src/index.js"]
