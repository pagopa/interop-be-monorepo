# Frontend local runtime

This runtime is the backend half of the frontend devcontainer workflow. It
starts the BFF plus the process, SQL readmodel writer, and DynamoDB
platform-state writer services needed by the back office.

The frontend repository owns the normal orchestration. From its devcontainer,
use `pnpm local:start`, `pnpm local:stop`, and `pnpm local:reset` instead of
starting these commands separately.

## Backend commands

| Command | Effect |
| --- | --- |
| `pnpm local:start:frontend-full` | Starts the frontend-oriented backend service set |
| `pnpm local:seed` | Idempotently creates local tenants and the base published catalog entry through APIs/events |
| `pnpm local:token -- --tenant comune --role admin` | Prints a local-KMS signed token |
| `pnpm local:token -- --tenant comune --role admin --output .local-development/frontend-token` | Writes the token used by the frontend |
| `pnpm infra:start` | Starts infrastructure, waits for readiness, creates Kafka topics, and registers Debezium |
| `pnpm infra:stop` | Stops containers while preserving named volumes |
| `pnpm infra:reset` | Stops containers and removes local named volumes |

Tenants: `comune`, `provider`, `impresa`, `certificatore`.
Roles: `admin`, `api`, `security`, `reviewer`, `viewer`.

Generated IDs and tokens live under the ignored `.local-development`
directory. The dataset contains stable Selfcare identities, but Interop tenant
IDs are discovered from the running system and must not be assumed to match IDs
from old local scripts.

## Infrastructure

Docker Compose supplies PostgreSQL event store/readmodels, Kafka and
Zookeeper, Debezium, DynamoDB, Redis, MinIO, local KMS/JWKS, ElasticMQ, Mailpit,
and the local Selfcare mock. Kafka topics and the Debezium connector are
created idempotently by `infra:start`.

The Selfcare mock implements the institution, product, institution-user, and
user lookups used by the BFF. Its source dataset is
`docker/local-development/dataset.json`.

Docker data is persistent. Use `infra:reset` only when a clean rebuild is
intended; it deletes this Compose project's local volumes.

The frontend-oriented profile starts backend services without file watching to
keep the complete stack within typical Docker Desktop memory limits. Set
`INTEROP_BACKEND_WATCH=true` before startup when working on backend code; this
uses more memory and may require increasing the Docker VM allocation.
