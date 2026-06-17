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

# Database migrations are applied by deployment/ops before startup.
CMD ["sh", "-c", "node src/seed.js && node src/index.js"]
