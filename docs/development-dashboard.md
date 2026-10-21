# Local development dashboard

The backend repository owns the dashboard, its API and the process supervisor.
It runs in a Docker Compose container independently of Vite, VS Code and the
frontend checkout. Application sources are bind-mounted from this checkout;
changes in the editor are the same files used by the running processes.

## Start with the backend only

Requirements: Git checkout, Bash and Docker with Compose v2. Host Node.js and
pnpm are not required. On Windows, run these commands from a WSL2 Linux checkout
with Docker Desktop integration enabled. macOS includes Bash; Docker Desktop
must have access to the checkout. The image supports amd64 and arm64.

```bash
bash scripts/local-development/dashboard.sh start
```

Open **http://localhost:8076**. Initial dependency installation and dashboard
compilation appear in `bash scripts/local-development/dashboard.sh logs`.
Dashboard builds use the workspace's Turbo cache: unchanged generation and
compilation are reused on later starts, including restoring missing build
outputs. After the shared contracts are built, the API and UI build in parallel.
The API then prepares infrastructure automatically: Kafka recovery, container
startup, migrations and RustFS fixtures, topic creation and Debezium registration.
No application package starts automatically unless a startup preset is selected.

Use the package catalogue to start individual services. Their workspace build
dependencies are prepared automatically; other application services are not
started implicitly by **Start**. The table shows the package's actual workspace
name, port, process state and watch setting, with Start/Stop and Logs actions.
Workspace names use the same monospace styling as infrastructure container names,
with compact, vertically aligned rows.
Use the Preset filter to limit the table to a shared or local preset. Select rows
for bulk Start, Stop, Watch on or Watch off. The header checkbox selects the
visible rows; changing the search or preset clears the selection. Bulk actions
skip rows already in the requested state or currently busy. Start shares the
workspace dependency build across selected packages. A failure on an individual
package is reflected in its state while the other selected packages continue;
failure details are available in Logs.
The list comes from executable package entrypoints in the checkout; ports come
from their local environment configuration, including the dashboard's local
endpoint overrides. Packages without an HTTP port show a dash.

There is no separately maintained catalogue of process, infrastructure or data
dependencies. Start operates on the selected package; configure service groups
explicitly through presets. Startup failures appear beside the affected controls
and in logs.

```bash
bash scripts/local-development/dashboard.sh status
bash scripts/local-development/dashboard.sh logs
bash scripts/local-development/dashboard.sh stop
```

The last command stops the runtime itself. Use the dashboard infrastructure
controls to stop infrastructure while keeping the dashboard available.

## Processes and presets

Use the navigation to open Packages, Presets, Infrastructure, Access token or
Logs. Each section has its own URL hash, so browser history and refresh
retain the selected view. A package's log action opens Logs with that package
selected. On Packages, Presets, Infrastructure and Access token, action progress
appears in the button used. Diagnostics are available through Logs.

When opened from the frontend devcontainer, the dashboard also offers **Fullstack
status** at `#/status` and uses it as the initial page. The current startup phases
include dependency installation, dashboard readiness, infrastructure, backend
services, seed, local identity, Vite, smoke tests and browser checks. Backend
operation details appear inside the corresponding startup phase. The page stays
focused on this timeline and frontend startup and Vite log tails, loaded only
when opened. **Open frontend** opens `http://localhost:3000/ui/it/` in a new tab
as soon as the frontend process is running, including while startup checks are
still pending. The button remains disabled until then. The timeline identifies
the local or shared development target; shared development omits local-only
startup phases. Infrastructure, packages and seeded data remain in their
existing views, and backend log links use the existing Logs view.

The frontend Compose overlay enables this view with
`DASHBOARD_FRONTEND_URL=http://frontend:8077`. This is an internal agent
owned by the frontend container; its port is not published on the host.
The backend validates the agent response and keeps its own status available
when the frontend is unreachable. Without this setting, the dashboard retains
its backend-only navigation and never contacts a frontend agent. With the
integration enabled, the dashboard API owns fullstack lifecycle progress and
delegates only frontend commands to the agent.

Each package has start, stop, logs and watch controls. Watch is on
by default and off for packages in the Frontend backend preset.
Changing watch immediately displays the requested checkbox value, with controls
disabled until that package's change finishes. The State chip shows `Queued`
while waiting, `Restarting` for a running package or `Updating watch` for a
stopped package. The Watch column keeps only its checkbox. Bulk rows unlock
independently; completed or failed changes show the backend's saved preference.
The operation's optional `watch` target restores this feedback after a page reload.
Changing watch for a running package restarts that package. Crashes are isolated
and remain visible until started again; there is no automatic crash restart.

Shared presets live in `docker/local-development/presets.json`. Personal presets
can be created, edited and deleted in the UI; their configuration persists in
`.local-development/dashboard/presets.json`. The Presets page separates shared
and local presets with compact section headings and separated rows; the local section and filter group appear only when local
presets exist. New preset and Edit open a modal editor with a package search.
Search matches workspace names and labels without changing hidden selections
or watch choices. The selection count includes packages hidden by the filter.
Clearing the search restores the complete list without resizing the table.
The editor uses compact rows and monospace workspace names.
Packages opens
`#/packages?preset=<id>` with only that preset's members. The filter persists
through refresh and browser history, and combines with package search.
A preset shows Running and disables Start when all its members are running.
Start and Stop show progress on the pressed button until the operation finishes.
Infrastructure Start, Stop and Reset likewise show progress on the relevant
button; other infrastructure actions are disabled until it finishes. Reset
is the outlined destructive first action in the table header, followed by Stop and Start,
with explicit confirmation before deleting local data. Infrastructure rows are compact.
The confirmation action is red and includes a delete icon.
Failed preset operations show a short startup/stop failure beside that preset,
with a Logs action that selects the preset's error logs. Retrying clears the failure.
The Source selector separates Shared presets and Local presets, followed by
Packages, Infrastructure and Runtime. Empty groups are omitted.
All packages (`group:packages`) includes only backend package logs. Infra
(`group:infra`) includes infrastructure logs, including retained logs from stopped
containers. Neither aggregate includes orchestration logs.
Selecting a preset aggregates only its package logs;
frontend and browser-check logs belong to the frontend launcher. The selection persists in
the URL together with the level filter. Search matches message text or correlation ID metadata,
case-insensitively and by substring. Package and infrastructure log actions keep all levels.
Orchestration logs are shared across runtime operations.
The log header's **By package** toggle collects consecutive entries from the same
source and service under one header, preserving their order. The header shows
the group's time range; levels, correlation IDs and individual line copying
remain available. This view setting does not change filters, line counts or
the contents of copied and downloaded logs.

The shared Frontend backend preset (`frontend-full`) contains the same 30 backend services
as the previous devcontainer script. All members have
watch disabled. Starting this preset only starts its backend packages.
The shared Tenant Seeding preset starts the four packages used by Start seed packages.
Manual seed remains a separate action in Access token.

A preset builds shared dependencies first, then starts up to four missing members
concurrently. Each start slot remains occupied until that package is ready.
HTTP services must pass their health check. Kafka consumers must join a stable
group and receive partition assignments under a unique client ID for that launch;
an older member cannot satisfy this check. The Kafka observer connects only to
local loopback brokers with AWS authentication disabled.

Dashboard-managed consumers use `earliest` for new local groups, so seed events
cannot be skipped if the first offset lookup occurs after group assignment.
Existing committed offsets retain precedence; a new group replays retained local
history. These overrides do not change package environment files or deployments.
Fullstack startup waits for every preset member before requesting seed. A failed
start prevents further preset members from launching, waits for in-flight starts
to settle and reports unlaunched members as skipped. Bulk package starts continue
the other selected packages after an individual failure.

Starting a preset leaves existing processes running. Stopping a preset stops
all its members, including members started separately, and leaves outsiders
running. Save per-package watch choices in the preset.

Access token offers an explicit **Seed local data** action using the existing
`pnpm local:seed` workflow. Presets do not execute seed, including older definitions
with `seed: true` or `fullstack: true`. Fullstack startup requests seed explicitly
after the backend preset is ready.
It requires the local tenant/catalog services and their readmodel writers and
uses `docker/local-development/dataset.json` to
create or reuse four demo tenants and a published Catalogo Demo eservice with
its OpenAPI interface. The local users and roles in that dataset are used for
token generation. The seed dataset is independent of presets; identifiers are
kept in `.local-development/state.json`. **Start seed packages** on Access token
starts tenant-process, catalog-process and their SQL readmodel writers. It starts
missing processes and preserves other running packages and watch choices.
Once all required packages are running, the button displays **Seed packages running**
with a checkmark and cannot start them again. Missing or stopped members restore
the startup action. A seeded environment displays **Local data seeded** with a
checkmark and disables the seed action. The action becomes available again when
the local data is no longer present, such as after an infrastructure reset.
Infrastructure is managed separately from its own page. This action does not
seed data or generate a token: use **Seed local data** next.
**Packages** remains available during and after startup and opens
`#/packages?group=seed`. The **Group** filter uses the complete seed package
list, so running members remain visible; refresh and browser history retain it.
Required packages must be running before seed; both shared presets include them.
**Logs** opens `#/logs?source=preset%3Atenant-seeding`, showing only the packages
in the **Tenant Seeding** preset. The Source filter offers this preset without a
duplicate Seed packages option. Older `group:seed` links redirect to the preset,
preserving the selected level.
When local identities are unavailable, the token card lists the exact seed
package names. An icon beside the Local access token title always offers Reload identities. Manual reloads
report whether identities were discovered, nothing was found or the request
failed through a snackbar at the bottom right. Requests cannot overlap; after completion
the icon indicates success or failure and remains disabled for two seconds.
The four header actions are Start seed packages,
Packages, Logs and Seed local data, in that order.
Seed and startup failures have a **Logs** button filtered to orchestration errors.
The seed button shows progress until completion; failures offer a link to
orchestration error logs. Successful seed reloads the available identities.
Access token also loads identities when opened and offers **Reload identities**,
so an external seed can be discovered without relying on cached readiness.
When local identities are available, the UI offers tenant/user selection to
generate and copy a local API token. Token generation returns the token to its caller;
the dashboard does not write a token into a frontend checkout.

## Fullstack and VS Code

To prepare infrastructure and the backend service group used by the frontend:

```bash
bash scripts/local-development/dashboard.sh start --preset frontend-full
```

This starts infrastructure and the selected backend packages. It does not seed data
or start Vite. Without `--preset`, startup prepares infrastructure without starting
application packages. `--preset` accepts any shared or personal
preset ID and can also be configured through `DASHBOARD_AUTOSTART_PRESET`.
`DASHBOARD_AUTOSTART=false` disables backend-only automatic startup. A frontend
agent can still explicitly request fullstack startup when its integration is enabled.

The frontend `.devcontainer` runs in a separate Compose service. VS Code, frontend
dependencies, Vite, smoke checks and browser checks belong to that container.
Its entrypoint starts the frontend agent and submits a startup action to the
dashboard API. The API coordinates installation, infrastructure, `frontend-full`,
seed, identity, Vite and checks. The agent executes frontend-only commands,
retaining ownership of Vite and frontend files. The dashboard does not mount the
frontend checkout. Use the frontend repository's CLI for lifecycle workflows;
the dashboard UI continues to offer status and logs. Closing VS Code leaves
the containers running; rebuilding the frontend container does not rebuild the backend
dashboard or replace its managed processes.

The CLI submits `POST /__local-dashboard/api/frontend/actions` with `type` set to
`start`, `stop`, `use-local`, `use-dev`, `reset`, or `identity` with `tenantKey` and
`userKey`. The endpoint is absent without the integration. Each accepted action
returns `operationId`; poll `GET /status` and match `frontend.operationId` until
`frontend.state` becomes `passed`, `stopped` or `failed`. Overlapping lifecycle
operations are rejected. Each backend phase retains its operation ID for detailed
progress. A failed startup skips subsequent phases and stops Vite; retry is explicit.

The agent exposes status/log reads and `POST /commands` for installation,
Vite start/stop and smoke/browser checks. Tokens travel only in a local-start
command and remain in the frontend's ignored state. Public status contains no
token or process ownership data. The existing backend `/actions`, `/identities`
and `/identity` endpoints remain available for standalone workflows.

The frontend is published at **http://localhost:3000/ui/it/**. The catalog process
uses port 3000 inside the backend runtime and is published on **http://localhost:13000**.
Other backend API ports retain their numbers on host loopback. The frontend keeps
its existing Docker publication for access through the host gateway; dashboard
and backend API publications are bound to host loopback.
The authorization process keeps port 3300; the authorization server uses local
port 4700 so both can run together without occupying the M2M gateway's port 4600.
The local authorization-server override also aligns issued M2M token audiences
with both gateway configurations. Client assertions and domain state must still
match the configured authorization flow.

## Logs and infrastructure data

Logs cover managed application processes, startup steps and every Compose
infrastructure container, including initialization containers. Filter the
aggregate stream by Source, Level and Search, which also matches correlation IDs.
Cursor-based fetches keep the browser log window bounded rather than reloading whole files.
Changing filters keeps the log viewport mounted, preserving focus and scroll during
loading. The previous snapshot is marked as updating until the new results arrive;
Copy, Download and correlation-ID copy remain disabled during this transition.
Each log row has a vertically centred Copy action that fades in and out on hover;
focus alone does not keep it visible. Touch devices show it directly. It copies
the exact message, preserving multiline text, without shifting
the row. Correlation-ID copy is separate, beside the ID. Copy feedback appears in
a bottom-right snackbar, keeping the log viewport stable. Its close button sits
inside the notification, allowing manual dismissal before it closes automatically.

## Dashboard frontend architecture

The Vite application lives in `packages/dev-dashboard-ui`. `App.tsx` composes
providers and routes; it contains no page logic or API calls.

- `router/` defines the five hash routes, shared paths and addressable package/log filters
  with React Router's route configuration and RouterProvider, matching the PDND frontend pattern.
  Hash URLs support both standalone and mounted dashboard access without server rewrite rules.
- `pages/` composes each dedicated view using the shared dashboard context.
- `components/layout/` owns the viewport shell, navigation and runtime controls.
- `components/ui/` contains ShadCN primitives; `components/common/` composes
  shared alerts, fields and layout elements from them.
- `api/dashboard/` groups typed services, query options and mutations, following
  the PDND frontend convention. `config/axios.ts` defines the shared Axios instance;
  `api/client.ts` centralizes errors and validation against shared dashboard contracts.
- `hooks/` owns runtime actions, identity/token state, selection, editors and
  incremental log streams. React Query owns status polling, cancellation and
  request deduplication. Browser effects are limited to external synchronization
  such as focus, stream subscriptions and timer cleanup.
- `test/` separates API, hook, component and integration tests from production
  code and provides fresh query clients for isolated tests.

The runtime's internal action identifiers are used to follow accepted commands
until completion and restore inline loading after navigation or refresh.

Infrastructure status treats SIGTERM exits (143) as stopped. SIGKILL exits (137)
are stopped only when Docker inspection confirms no OOM kill or engine error.
OOM kills, engine errors, dead containers and other nonzero exits remain failed;
an unavailable inspection keeps exit 137 failed. Exit codes remain visible.
Local KMS runs under Docker init so SIGTERM produces the expected signal exit
instead of Go's PID 1 fallback exit 2. This applies when Compose recreates the
container on the next infrastructure start; existing exit codes are retained.

Infrastructure **stop** preserves data. **Reset** requires confirmation in the
UI, stops managed backend processes and removes infrastructure data volumes and generated
seed state, then initializes clean infrastructure. It preserves the dashboard
container, dependency/cache volumes and personal presets. Application packages
remain stopped until explicitly started. It does not control Vite or delete files
in the frontend container; rerun the frontend launcher to prepare fresh seed data
and a token after resetting the backend.

Runtime state and generated Compose mounts are ignored under `.local-development`.
Regenerate the mounts and recreate the runtime after adding or removing workspace
packages, so every workspace dependency directory has its own Docker volume.

## API and UI development

`packages/dev-dashboard-contracts` contains the OpenAPI contract and generated
browser-safe Zod/Zodios schemas. The contract is `open-api/dashboardApi.yml`;
`generate-model` produces `src/generated/dashboardApi.ts`, exported through the
package's public entry point. Edit the YAML and regenerate instead of editing
generated schemas. Spectral validates the private local API with standard OpenAPI
rules; the public interoperability API policies are not applied to this developer tool.

`packages/dev-dashboard-api` follows the backend package structure:

- `config/` owns validated startup configuration, shared constants and local environment defaults.
- `routers/DashboardRouter.ts` defines the HTTP routes; `app.ts` composes middleware,
  routes and compiled UI assets.
- `services/` contains package discovery, environment validation, process supervision,
  infrastructure monitoring, identities and log handling.
- `model/domain/` defines internal schemas, driver interfaces and domain errors.
- `utilities/` contains query parsing, HTTP middleware, watch and shared helpers.
- `test/` covers local behavior with fake drivers and includes startup configuration checks.

Runtime services use the backend's `...ServiceBuilder` factory pattern. Each
factory keeps process handles, log buffers, timers and execution queues in its
own closure and returns the public functions. `index.ts` creates and connects
the services; public service interfaces declare their return types explicitly.
The supervisor composes application lifecycle, operation queue and preset
persistence services. Lifecycle phases remain sequential; independent catalogue
reads run concurrently. Log filtering and infrastructure inventory use indexed
lookups to avoid repeatedly scanning the same collections.

The API keeps the local tool's strict input validation and compact error responses;
production authentication and auditing middleware are not needed for the local runtime.
`packages/dev-dashboard-ui` is an independent React application
with local shadcn/ui components and Tailwind; it uses the PDND palette, Titillium
Web for the interface, DM Mono for code/logs and a light theme only. Fonts are
served locally. The API serves its compiled assets on the same origin.

With local dependencies installed, focused checks are:

```bash
pnpm --filter pagopa-interop-dev-dashboard-contracts generate-model
pnpm --filter pagopa-interop-dev-dashboard-contracts build
pnpm --filter pagopa-interop-dev-dashboard-contracts lint:openapi
pnpm --filter pagopa-interop-dev-dashboard-contracts test
pnpm --filter pagopa-interop-dev-dashboard-api test
pnpm --filter pagopa-interop-dev-dashboard-ui test
node --test scripts/local-development/test/dashboard-runtime.test.mjs
```

The infrastructure mocks and seed workflow are described in
[frontend-local-runtime.md](frontend-local-runtime.md).
