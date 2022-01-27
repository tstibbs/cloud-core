FROM node:14-alpine

WORKDIR /usr/src/app

COPY app/*.js* ./

RUN npm ci --only=production

ENTRYPOINT [ "node", "." ]
