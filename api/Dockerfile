FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx tsc

CMD ["node", "dist/index.js"]
