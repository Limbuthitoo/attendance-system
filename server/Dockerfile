FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
RUN mkdir -p data
EXPOSE 3001
CMD ["node", "src/index.js"]
