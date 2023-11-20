FROM node:20-alpine

ENV NPM_CONFIG_ENGINE_STRICT=true

WORKDIR /usr/src/app

COPY app/*.js* ./

RUN npm ci --omit=dev

CMD [ "node", "uptime-client.js" ]
