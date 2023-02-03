# use Alpine which is a lightweight docker image for node, 17 is the latest Node version
FROM node:17-alpine
COPY . /app
COPY .env.docker /app/.env
RUN cd /app && npm i
CMD cd /app && npm start