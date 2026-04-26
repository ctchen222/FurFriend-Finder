FROM node:latest

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY ./package* ./

RUN npm install

COPY . .

CMD ["node", "--require", "./dist/instrumentation.js", "dist/app.js"]