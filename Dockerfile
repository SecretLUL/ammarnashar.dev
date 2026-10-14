FROM oven/bun:alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY server.ts ./
COPY public ./public

EXPOSE 3000

CMD ["bun", "run", "server.ts"]
