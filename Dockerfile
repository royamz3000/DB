FROM node:20-slim

# better-sqlite3 is a native module; these let it build from source if a
# prebuilt binary isn't available for the target platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci

COPY . .
RUN npm --prefix frontend run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
