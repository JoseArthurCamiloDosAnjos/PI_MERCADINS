FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY . .

ENV NODE_ENV=production

RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["node", "src/server.js"]
