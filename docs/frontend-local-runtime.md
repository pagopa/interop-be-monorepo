# Frontend local runtime

The backend-owned [development dashboard](development-dashboard.md) orchestrates
the local environment independently of the frontend and VS Code. Its fullstack
preset starts the BFF, processes, SQL readmodel writers and DynamoDB platform-state
writers needed by the back office. The frontend CLI delegates to that API.

## Backend commands

| Command | Effect |
| --- | --- |
| `bash scripts/local-development/dashboard.sh start` | Starts the dashboard and infrastructure without application packages |
| `bash scripts/local-development/dashboard.sh start --frontend /path/to/frontend --preset frontend-full` | Starts the common runtime and fullstack preset |
| `pnpm local:seed` | Idempotently creates local tenants and the base published catalog entry through APIs/events |
| `pnpm local:token -- --tenant comune --user admin` | Prints a local-KMS signed token |
| `pnpm local:token -- --tenant comune --user admin --output .local-development/frontend-token` | Writes the token used by the frontend |
| `pnpm local:infra:start` | Starts infrastructure and prepares it for the frontend runtime |
| `pnpm local:infra:stop` | Stops frontend infrastructure while preserving named volumes |
| `pnpm infra:reset` | Removes infrastructure data while preserving the dashboard and its configuration |

Tenants: `comune`, `provider`, `impresa`, `certificatore`.
Roles: `admin`, `api`, `security`, `reviewer`, `viewer`.

Generated IDs and tokens live under the ignored `.local-development`
directory. The dataset contains stable Selfcare identities, but Interop tenant
IDs are discovered from the running system and must not be assumed to match IDs
from old local scripts.

## Infrastructure

Docker Compose supplies PostgreSQL event store/readmodels, Kafka and
Zookeeper, Debezium, DynamoDB, Redis, RustFS, local KMS/JWKS, ElasticMQ, Mailpit,
and the local Selfcare mock. The frontend-specific infrastructure command
waits for seed containers, creates Kafka topics, and registers Debezium through
the shared `infra:start` command.

The Selfcare mock implements the institution, product, institution-user, and
user lookups used by the BFF. Its source dataset is
`docker/local-development/dataset.json`.

Docker data is persistent. Use the dashboard reset confirmation when a clean
rebuild is intended. It removes infrastructure volumes; personal presets and
dependency volumes are preserved.

Infrastructure startup copies `docker/rustfs-seed` into RustFS and waits for that
copy to finish before the catalog seed runs. This includes the demo OpenAPI
document at `interop-local-bucket/local-development/openapi-demo.yaml`; new
interface metadata uses the SHA-256 checksum of those exact fixture bytes.
Start infrastructure before running `pnpm local:seed` separately.

For environments seeded before the demo document was included, restart local
infrastructure with `pnpm local:infra:start` to restore the missing file. The
existing published interface keeps its metadata, including the old
`local-development` placeholder checksum. A clean reset is required to recreate
it with the correct checksum; rerunning the catalog seed does not mutate a
published interface.

The fullstack preset starts backend services without watching to keep memory
use manageable. Toggle watch per package in the dashboard when working on backend
code. Individual packages enable watch by default. Watch choices can be saved in
personal presets.

## pgAdmin

Open `http://localhost:8082` after infrastructure startup. The Event Store and
Read Model servers are configured automatically and connect to the `root`
database without a password prompt. Other databases on those servers use the
same local `root` credentials.

pgAdmin runs directly from the backend Docker Compose configuration; it does
not depend on the frontend devcontainer. From the backend repository, start it
with `docker compose -f docker/docker-compose.yml up -d pg-admin` after starting
the databases. The shell entrypoint prepares the password file with private
permissions, then delegates initialization to the image's official entrypoint.

An existing container can still have the old read-only root filesystem even when
the Compose file has been updated. If its logs report that
`/pgadmin4/config_distro.py` cannot be created, recreate only pgAdmin:

```bash
docker compose -f docker/docker-compose.yml up -d --no-deps pg-admin
```

This keeps the `pg-admin-data` volume and does not restart the databases.

The server definitions are imported only when pgAdmin creates its configuration
database. Later starts preserve configured servers and preferences.

If an older failed startup left both default servers absent from an existing
volume, import them once after pgAdmin is running:

```bash
docker compose -f docker/docker-compose.yml exec -T pg-admin \
  /venv/bin/python3 /pgadmin4/setup.py load-servers /pgadmin4/servers.json \
  --user root@example.com
```

This uses pgAdmin's supported CLI and adds the definitions without replacing
custom servers. Run it only when both defaults are absent: repeating it adds
duplicates. Existing defaults that still reference `/pgadmin4/pgpass` need their
password-file path changed to `/var/lib/pgadmin/pgpass` in pgAdmin.
