> NOTE: this repo is still a work in progress

# Interoperability Monorepo

## How to start

To get started, you will need:

- Node.js (https://nodejs.org/en/download/package-manager)
- pnpm (https://pnpm.io/installation)
- Docker (for local development, https://www.docker.com/get-started/)

Then install the dependencies with

```
pnpm install
```

## How to run a single service in watch mode

```
pnpm start:<service-name>
# example: pnpm start:catalog
```

## How to run the tests

```
pnpm test
```

## How to work locally with the read model

First, start a consumer service by running (for example):

```
pnpm start:catalog-consumer
```

This will start a local instance of Debezium (alongside with its requirements Zookeeper and Kafka) and a local MongoDB instance which will contain the read model.

Then, start a process service by running (for example):

```
pnpm start:catalog
```

This will start a local Postgres instance for storing the events and the service itself.

You can test everything is working by posting an event to the service, for example:

```bash
curl -X POST http://localhost:3000/eservices \
  -d '{ "name": "Example name", "description": "Example description", "technology": "REST", "attributes": { "certified": [], "declared": [], "verified": [] } }' \
  -H "Content-Type: application/json" \
  -H 'X-Correlation-Id: test' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdhbml6YXRpb25JZCI6IjRENTU2OTZGLTE2QzAtNDk2OC04NTRCLTJCMTY2Mzk3RkMzMCIsInVzZXItcm9sZXMiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInVpZCI6IjBmZGEwMzNjLThlOGUtNDhhOS1hMGZjLWFiYmExZjcxMWZlZiIsIm9yZ2FuaXphdGlvbiI6eyJyb2xlcyI6W3sicm9sZSI6IkFkbWluIn1dfSwiZXh0ZXJuYWxJZCI6eyJvcmlnaW4iOiJJUEEiLCJ2YWx1ZSI6IjEyMzQ1NiJ9fQ.308Ulfu4JXXMhqsWo26MIWWhv8tp3sdl-pU5gN_SIX4" 
```

You should see the event being processed by the consumer and the read model being updated.

You can verify this by using Mongo Express, which is being started alongside the consumer and is available at http://localhost:8081/db/readmodel.

Similarly, there is a Postgres web client that can be used to inspect the event stores at http://localhost:8082.
