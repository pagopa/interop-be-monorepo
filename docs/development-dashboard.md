# Local development dashboard

The dashboard starts backend packages, manages local infrastructure, collects logs,
and generates local access tokens. It runs in a Docker Compose container owned by
this repository. You can use it without the frontend checkout or VS Code.
The container bind-mounts your checkout, so editor changes are available to its
managed processes.

## Start the dashboard

You need a backend checkout, Bash, and Docker with Compose v2. The container
installs dependencies and builds the dashboard. Host Node.js and pnpm are not required.

On Windows, use a WSL2 Linux checkout with Docker Desktop integration enabled.
On macOS, allow Docker Desktop to access the checkout. The runtime supports
amd64 and arm64.

1. From the backend repository root, start the runtime:

   ```bash
   bash scripts/local-development/dashboard.sh start
   ```

2. Follow the first installation and build:

   ```bash
   bash scripts/local-development/dashboard.sh logs
   ```

3. Open [the dashboard](http://localhost:8076). Infrastructure starts automatically.
   Wait for its startup operation to finish, then open **Packages** to start the
   services you need.

Startup prepares Kafka, starts infrastructure containers, waits for initialization,
creates topics, and registers Debezium. Initialization includes migrations and
RustFS fixtures. No application package starts unless you select a startup preset.
Turbo reuses cached dashboard builds on subsequent starts.

To start a service group with the dashboard, pass its preset ID:

```bash
bash scripts/local-development/dashboard.sh start --preset frontend-full
```

The `frontend-full` preset starts the backend services used by the frontend with
watch disabled. It does not seed data or start Vite. Any shared or personal preset
ID can be used with `--preset`.

## Check and stop the runtime

Check the dashboard container or follow its bootstrap logs:

```bash
bash scripts/local-development/dashboard.sh status
bash scripts/local-development/dashboard.sh logs
```

To stop managed backend packages and infrastructure while keeping the dashboard
available, open **Infrastructure** and select **Stop**. Local data remains intact.

To stop the dashboard container itself, run:

```bash
bash scripts/local-development/dashboard.sh stop
```

This command also stops its managed backend processes. It leaves infrastructure
containers running. Use **Infrastructure > Stop** first when you want to stop both.

## Work with packages and presets

### Start packages

**Packages** lists executable workspace packages with their ports, process states,
and watch settings. Search by package name or filter by preset. Each package has
**Start**, **Stop**, and **Logs** actions.

**Start** builds the selected package's workspace dependencies before launching it.
It does not start other application services. Use a preset to define the service
group required by your task.

Select rows to start or stop several packages, or to change their watch settings.
The header checkbox selects the visible rows. Changing the search or preset clears
the selection. Bulk actions skip packages already in the requested state or busy
with another action. If one bulk start fails, the other selected packages continue.
Open **Logs** for failure details.

Watch is enabled by default. Changing watch for a running package restarts that
package. The checkbox shows the requested watch setting while the status reports
the restart. The dashboard saves watch preferences, and presets can specify their own
per-package watch settings. A crashed package remains failed until you start it
again. The supervisor does not restart crashes automatically.

### Start service groups

**Presets** lists shared and personal presets. Select **Start** or **Stop** to act
on a group, or **Packages** to inspect its members. Create, edit, and delete personal
presets in this page. The editor lets you select packages and their watch settings.

Starting a preset leaves already running packages unchanged. Stopping a preset
stops all its members, including packages started separately, and leaves packages
outside the preset running.

A preset builds shared dependencies first, then starts up to four missing members
concurrently. Each slot remains occupied until its package is ready. HTTP services
must pass their health check. Kafka consumers must join a stable group and receive
partition assignments under a unique client ID for that launch.

If a preset member fails, the dashboard stops launching further members, waits for
in-flight starts, and marks the remaining members as skipped. Retry explicitly
after resolving the failure. Preset log filters contain package output. Select
the orchestration source to inspect dependency builds and runtime operations.

## Seed data and generate a token

Use **Access token** for a standalone backend session:

1. Select **Start seed packages**. This starts missing tenant and catalog processes
   and their SQL readmodel writers. Other packages and watch settings remain unchanged.
2. Wait until the required packages are running, then select **Seed local data**.
3. Select a tenant and user, generate a local API token, and copy it.

The shared **Tenant Seeding** preset contains the required seed packages. Starting
a preset does not seed data. The seed action uses the `pnpm local:seed` workflow
to create or reuse demo tenants and a published Catalogo Demo eservice with its
OpenAPI interface. Dataset users and roles provide the available token identities.

The page disables seed when local data is already present. An infrastructure reset
makes seed available again. Reopening **Access token** reloads identities, including
data seeded outside the dashboard. The **Packages** and **Logs** actions show the
seed package group. Seed failures link to orchestration error logs.

Token generation returns a token to the caller. It does not write a token into a
frontend checkout. See [frontend-local-runtime.md](frontend-local-runtime.md)
for the dataset, seed workflow, and mock services.

## Inspect and reset infrastructure

**Infrastructure** shows Compose containers, their status, exit codes, and logs.
Use **Start** to prepare infrastructure or **Stop** to stop infrastructure and
managed backend packages without deleting data.

**Reset** requires confirmation in the dashboard UI. It stops managed backend
packages, deletes infrastructure data volumes and generated seed state, and
initializes clean infrastructure. The dashboard container, dependency caches,
personal presets, and watch preferences remain available. Application packages
remain stopped.

Reset does not stop Vite or delete files in the frontend container. For an
integrated frontend session, use the frontend lifecycle scripts to reset and
prepare a fresh session.

## Read and export logs

**Logs** collects package output, orchestration output, and logs from Compose
infrastructure containers, including initialization containers. Select a source,
level, or search term. Search matches message text and correlation IDs without
case sensitivity. Package and preset log links open this page with a source filter.
The source and level filters remain in the URL. Runtime status and logs update
automatically every two seconds.

The **All packages** source includes backend package logs. **Infra** includes
infrastructure logs, including retained output from stopped containers. A preset
source includes only its members. These sources exclude orchestration logs.
Use the orchestration source for builds, infrastructure preparation, and seed errors.

Use **Copy** or **Download** to export the loaded log entries. Individual entries
also offer message and correlation-ID copy actions. Message copy preserves
multiline text. Docker timestamps are metadata, while application timestamps
remain part of the original message.

**By package** groups consecutive entries with the same source and service under
one header without changing their order. Disable it to see entry-level severity,
correlation IDs, and copy controls. Grouping does not change filters or exported
content. The browser saves this preference in local storage.

## Connect the frontend

The frontend devcontainer runs in a separate Compose service. Its scripts manage
frontend dependencies, Vite, smoke checks, browser checks, and frontend files.
The dashboard does not mount the frontend checkout.

The frontend Compose overlay sets `DASHBOARD_FRONTEND_URL=http://frontend:8077`.
This enables **Fullstack status**, which becomes the initial dashboard page.
The frontend agent uses an internal port that is not published on the host.
Without this setting, the dashboard provides only backend views and does not
contact a frontend agent.

**Fullstack status** shows the selected local or shared development target,
startup phases, backend operation details, and optional frontend startup and Vite
log tails. **Open frontend** opens `http://localhost:3000/ui/it/` once Vite is running.
This page reports status and logs. Use the frontend scripts for lifecycle actions.

For local startup, the dashboard API coordinates infrastructure, the backend
preset, seed, identity, and frontend commands. It waits for all preset members
before seed. The frontend agent executes frontend commands and keeps the local
token in ignored frontend state. A failed startup skips subsequent phases and
stops Vite. Retrying requires an explicit lifecycle action.

See `docs/local-full-stack.md` in the `pdnd-interop-frontend` checkout for frontend
setup and lifecycle commands.

## Technical reference

### Runtime and networking

`scripts/local-development/dashboard.sh` generates the Compose override at
`.local-development/dashboard/compose.yml`. It bind-mounts the backend checkout
and creates separate dependency volumes for the workspace root and each package.
The entrypoint installs dependencies, builds the dashboard with Turbo, and starts
the API. Application processes share the runtime container and use local loopback
proxies to reach infrastructure.

Dashboard and backend API ports bind to host loopback. The catalog process uses
port `3000` inside the runtime and host port `13000`, leaving host port `3000`
for the frontend. The authorization process uses `3300`, the authorization server
uses `4700`, and the M2M gateway uses `4600`.

Package discovery reads workspace manifests and executable `src/index.ts` files.
Ports come from each package's effective local environment. The runtime applies
local endpoint overrides and validates outgoing endpoint settings before launch.
AWS adapters use local endpoints and test credentials. Kafka readiness probes
require loopback brokers with AWS authentication disabled.

Dashboard-managed Kafka consumers use `earliest` for new local groups so they
can consume seed events already in the topic. Existing committed offsets take
precedence. These runtime overrides do not edit package environment files.

### Configuration and local files

The startup configuration lives in `packages/dev-dashboard-api/src/config/config.ts`.

| Setting                      | Purpose                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `INTEROP_BE_ROOT`            | Backend checkout path. The startup script defaults to its repository root.                  |
| `DASHBOARD_AUTOSTART_PRESET` | Preset to start after infrastructure. `--preset` overrides this value.                      |
| `DASHBOARD_AUTOSTART=false`  | Disable automatic infrastructure and preset startup. Explicit actions remain available.     |
| `DASHBOARD_FRONTEND_URL`     | Optional local HTTP origin of the frontend agent, supplied by the frontend Compose overlay. |
| `DASHBOARD_PORT`             | API listen port, default `8076`. Compose publication must match any override.               |

The startup script forwards the checkout path and autostart settings into its
generated Compose override. Other API settings require container configuration.

| Path                                              | Contents                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| `docker/local-development/presets.json`           | Shared preset definitions.                          |
| `docker/local-development/dataset.json`           | Demo tenants, users, roles, and eservice seed data. |
| `.local-development/dashboard/presets.json`       | Personal presets.                                   |
| `.local-development/dashboard/watch.json`         | Saved package watch preferences.                    |
| `.local-development/state.json`                   | Generated seed identifiers.                         |
| `.local-development/dashboard/logs/bootstrap.log` | Dependency installation and dashboard build output. |

Generated runtime files under `.local-development` are ignored by Git.

### Packages and API contracts

| Package                            | Responsibility                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/dev-dashboard-contracts` | OpenAPI definition and generated browser-safe Zod and Zodios schemas.                                 |
| `packages/dev-dashboard-api`       | Express API, package discovery, process supervision, infrastructure operations, identities, and logs. |
| `packages/dev-dashboard-ui`        | React and Vite application, hash routes, typed API services, React Query state, and log views.        |

The API serves compiled UI assets on the same origin. Hash routes preserve
page and filter navigation without server rewrite rules. Cursor-based log reads
and entry virtualization keep the browser log window bounded.

The contract is
`packages/dev-dashboard-contracts/open-api/dashboardApi.yml`. Edit the YAML and run
`generate-model` instead of editing `src/generated/dashboardApi.ts`.
The package's `.spectral.yaml` selects the OpenAPI rules used by `lint:openapi`.
Its `template.hbs` is the Handlebars template used by `openapi-zod-client` to
generate the TypeScript schemas and endpoint definitions.

API routes use the `/__local-dashboard/api` prefix. Accepted runtime actions
return an `operationId`, which clients follow through `GET /status`.

When frontend integration is enabled, `POST /frontend/actions` accepts `start`,
`stop`, `use-local`, `use-dev`, `reset`, and `identity`. Identity actions include
`tenantKey` and `userKey`. Clients match `frontend.operationId` in status until
the operation passes, stops, or fails. Overlapping lifecycle operations are
rejected. Frontend action and log endpoints return `404` when integration is disabled.

The frontend agent provides status and log reads plus `POST /commands`. Tokens
travel in local-start commands and are absent from public status responses.
Standalone backend workflows use `/actions`, `/identities`, and `/identity`.

### Development checks

With local dependencies installed, use these focused checks when changing the
dashboard. Regenerate and build contracts before checking affected consumers.

```bash
pnpm --filter pagopa-interop-dev-dashboard-contracts generate-model
pnpm --filter pagopa-interop-dev-dashboard-contracts build
pnpm --filter pagopa-interop-dev-dashboard-contracts lint:openapi
pnpm --filter pagopa-interop-dev-dashboard-contracts test
pnpm --filter pagopa-interop-dev-dashboard-api check
pnpm --filter pagopa-interop-dev-dashboard-api test
pnpm --filter pagopa-interop-dev-dashboard-ui check
pnpm --filter pagopa-interop-dev-dashboard-ui test
node --test scripts/local-development/test/dashboard-runtime.test.mjs
```

## Troubleshoot startup

| Symptom                                             | Check                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard does not open                             | Run `dashboard.sh status` and `dashboard.sh logs` to inspect container startup, installation, and build failures.                                  |
| Package or preset fails                             | Open its logs. For dependency build failures, select orchestration logs. Check that required application services are running.                     |
| Seed is unavailable or fails                        | Start the seed packages, wait for readiness, and inspect orchestration errors. Check infrastructure status.                                        |
| Frontend status is unavailable                      | Check the frontend container and its agent through the frontend lifecycle scripts. Backend status remains available independently.                 |
| Startup reports a missing dependency volume         | Run `bash scripts/local-development/dashboard.sh start` to regenerate mounts and recreate the runtime after adding or removing workspace packages. |
| Infrastructure remains after stopping the dashboard | Restart the dashboard and use **Infrastructure > Stop**. The runtime stop command leaves infrastructure running.                                   |

For infrastructure mocks and seed-specific configuration, see
[frontend-local-runtime.md](frontend-local-runtime.md).
