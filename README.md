# lucid-fmbot

a Discord.js bot that implements some missing features of .fmbot

## Setup

You will need a Mongo database to connect to. It's recommended to use Docker for that even if you're running the bot locally.

### Run the bot

This will start the bot in the current terminal. Docker is recommended for long term use although as long as you keep the terminal open the bot will keep running.

1. set up `.env` using `.env.sample` as a template
1. `npm i`
1. `npm run build`
1. `npm run start`

### Develop locally

This will spin up two nodemon services so you can restart the bot without having to build again.

1. set up `.env` using `.env.sample` as a template
1. `npm i`
1. `npm run build:watch`
1. open a new terminal window in the same directory
1. `npm run watch`

## Docker Setup

Mongo setup is included here. These commands will build and launch a Docker container that has two images, one for Mongo and one for Node (the bot itself).

1. set up `.docker.env` using `.env.sample` as a template
1. `docker compose build`
1. `docker compose up -d`
