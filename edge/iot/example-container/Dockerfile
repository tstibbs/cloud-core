FROM node:22-alpine

ENV NPM_CONFIG_ENGINE_STRICT=true

WORKDIR /usr/src/app

RUN npm install -g pnpm@12

COPY app/*.js* app/pnpm-*.yaml ./

RUN pnpm ci --prod

CMD [ "node", "uptime-client.js" ]
