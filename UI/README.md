# SVT UI

## Project Overview

This is UI for EpicMeasure project. Project represents **2 services**: front-end (FE) and the back-end (BE) part of the application. 
- **Front-end** part use **Angular** framework. 
- **Back-end** part use **NestJS** framework.

## Environment Requirements

- [Node.js](https://nodejs.org/en/]sdcsdscsdc) ^20.19.0 (20.19@latest is good enough)

## Development

- Ensure that you have install all the dependencies: `npm install`
- Start both FE and BE: `npm run start` => browser will be open automatically `http://localhost:7755/app`
- Start FE: `npm run start::ui` => the app will be running: `http://localhost:7755/app`
- Start BE: `npm run start::api` => the app will be running: `http://localhost:9393/api`

> **_NOTE:_**  
> Kafka broker should be running before yuo start project (BE side).

## How To Build the app

- `npm install`
- `npm run build::all`
- Build result will be placed in the folder `dist/apps`

## Epic DB Agent

Fake db agent, used just for testing purposes. You can run the project with the command: start::db-agent

## Docker


```
# Build
docker build -t epic-measure .

# Run (default port 8080)
docker run -p 8080:8080 epic-measure

# Run with custom port and env vars
docker run -p 3000:3000 \
  -e SVT_UI_PORT=3000 \
  -e KAFKA_BROKER=kafka.prod:9092 \
  -e SVT_UI_API_PORT=9393 \
  epic-measure

# Push to registry
docker tag epic-measure your-registry.com/epic-measure:latest
docker push your-registry.com/epic-measure:latest
```
