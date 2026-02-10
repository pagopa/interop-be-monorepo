> NOTE: this repo is still a work in progress

# Interoperability Monorepo

## How to start

To get started, you will need:

- Node.js (<https://nodejs.org/en/download/package-manager>)
- pnpm (<https://pnpm.io/installation>)
- Docker (for local development, <https://www.docker.com/get-started/>)

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

This will start a local instance of Debezium (alongside with its requirements Zookeeper and Kafka) and a local PostgreSQL instance which will contain the read model.

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

You can verify this by using PgAdmin, which is being started alongside the consumer and is available at <http://localhost:8082>. That can be used to inspect the event store.

## Licensing

This project is licensed under the terms of the **European Union Public Licence version 1.2 (EUPL-1.2)**.
The full text of the license can be found in the [LICENSE](LICENSE) file.
Please see the [AUTHORS](AUTHORS) file for the copyright notice.

### Package specific licensing

Since this is a monorepo, some packages may have different licensing terms.
For detailed info regarding each package of the monorepo, please refer to their respective license files.

## Test change

This is a test change to verify caching behavior
