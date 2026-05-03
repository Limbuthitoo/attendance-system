FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p data/apk data/branding

EXPOSE 3001

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/seed.new.js && node src/index.new.js"]
