FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

EXPOSE 3000

# WATCHPACK_POLLING habilita hot-reload por polling, necesario en Docker sobre Windows
ENV WATCHPACK_POLLING=true

CMD ["npm", "run", "dev"]
