# use Alpine which is a lightweight docker image for node, 17 is the latest Node version
FROM node:17-alpine
COPY ./dist /lucid-fmbot/dist
# need the package.json so we can use modules
COPY package.json /lucid-fmbot/package.json
COPY .env.docker /lucid-fmbot/.env
RUN cd /lucid-fmbot && npm i
# RUN ls lucid-fmbot
CMD cd /lucid-fmbot && npm start
