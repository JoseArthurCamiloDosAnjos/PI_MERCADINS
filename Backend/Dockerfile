FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY . .

ENV NODE_ENV=production

# Pasta das imagens enviadas (upload local): criada aqui para o volume do
# Docker herdar a posse do usuário node na primeira subida
RUN mkdir -p /app/imagens \
  && chown -R node:node /app
USER node

EXPOSE 3001

CMD ["node", "src/server.js"]
