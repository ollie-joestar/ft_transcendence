FROM node:24.14.1-alpine3.23 AS dev

RUN apk add --no-cache python3 make g++ curl
WORKDIR /app

# Keep lockfile in dev stage too for deterministic installs and better layer caching.
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .
COPY ./ENTRYPOINT.sh /ENTRYPOINT.sh
RUN chmod +x /ENTRYPOINT.sh

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/ENTRYPOINT.sh"]

# -----------------------------------------------

FROM node:24.14.1-alpine3.23 AS production

RUN apk add --no-cache python3 make g++ curl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

RUN npm prune --omit=dev

COPY ./ENTRYPOINT.sh /ENTRYPOINT.sh
RUN chmod +x /ENTRYPOINT.sh

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/ENTRYPOINT.sh"]
