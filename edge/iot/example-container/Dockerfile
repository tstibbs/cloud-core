FROM node:current-alpine

WORKDIR /usr/src/app

COPY app/*.js* ./

RUN npm ci --only=production

CMD [ "node", "uptime-client.js" ]
