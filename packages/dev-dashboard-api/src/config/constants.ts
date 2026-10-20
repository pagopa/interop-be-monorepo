import {
  LogEntry,
  type DashboardAction,
  type FrontendAction,
} from "pagopa-interop-dev-dashboard-contracts";

export const DASHBOARD_UI_BASE_PATH = "/__local-dashboard";
export const DASHBOARD_API_BASE_PATH = `${DASHBOARD_UI_BASE_PATH}/api`;
export const MAX_PORT = 65_535;

export const PACKAGE_LAYOUT = Object.freeze({
  directory: "packages",
  manifest: "package.json",
  entrypoint: "src/index.ts",
  dashboardPrefix: "dev-dashboard-",
  source: "src",
  runtimeEntrypoint: "./src/index.ts",
  runner: "node_modules/.bin/tsx",
});

export const PACKAGE_READINESS_PATHS = Object.freeze({
  default: "/status",
  backendForFrontend: "/backend-for-frontend/0.0/status",
});

export const WORKSPACE_BUILD_CONCURRENCY = 2;

export const OPERATION_PHASE_IDS = Object.freeze({ build: "build" });

export const FRONTEND_STARTUP_PHASES = Object.freeze({
  install: "Frontend dependencies and browser",
  dashboard: "Backend dashboard API",
  infra: "Infrastructure",
  backend: "Frontend backend preset",
  seed: "Local seed",
  identity: "Local identity",
  vite: "Vite",
  smoke: "Smoke checks",
  browser: "Browser checks",
});

export const FRONTEND_ACTION_PHASES: Readonly<
  Record<
    FrontendAction["type"],
    readonly (keyof typeof FRONTEND_STARTUP_PHASES)[]
  >
> = Object.freeze({
  start: [
    "install",
    "dashboard",
    "infra",
    "backend",
    "seed",
    "identity",
    "vite",
    "smoke",
    "browser",
  ],
  stop: ["vite", "backend"],
  reset: ["vite", "infra"],
  "use-dev": ["vite"],
  "use-local": ["identity", "vite"],
  identity: ["identity", "vite"],
});

export const ENVIRONMENT_KEYS = Object.freeze({
  ignoreConfiguredEndpoints: "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS",
});

export const ENVIRONMENT_RULES = Object.freeze({
  nodeEnvironment: "development",
  hostSuffixes: ["_HOST", "_HOSTNAME", "_ADDRESS"],
  serverHostSuffix: "SERVER_HOST",
  kafkaBrokersSuffix: "KAFKA_BROKERS",
  callbackFragment: "CALLBACK",
  endpointFragment: "ENDPOINT",
  urlSuffix: /_URLS?$/,
  localProtocol: "http:",
});

export const INHERITED_ENVIRONMENT_PREFIXES = ["INTEROP_", "DASHBOARD_"];

export const CONTAINER_EXIT_CODES = Object.freeze({
  sigkill: 137,
  sigterm: 143,
});

export const DASHBOARD_PATHS = Object.freeze({
  personalPresets: ".local-development/dashboard/presets.json",
  watchPreferences: ".local-development/dashboard/watch.json",
  sharedPresets: "docker/local-development/presets.json",
  dataset: "docker/local-development/dataset.json",
  seedState: ".local-development/state.json",
  bootstrapLog: ".local-development/dashboard/logs/bootstrap.log",
  uiDist: "packages/dev-dashboard-ui/dist",
  composeFile: "docker/docker-compose.yml",
  infraScript: "scripts/local-development/dashboard-infra.sh",
  localCli: "scripts/local-development/cli.mjs",
});

export const DASHBOARD_TIMING = Object.freeze({
  processGraceMs: 5000,
  processKillWaitMs: 1000,
  commandTimeoutMs: 120_000,
  infraCommandTimeoutMs: 180_000,
  workspaceBuildTimeoutMs: 900_000,
  identityCommandTimeoutMs: 30_000,
  inventoryCommandTimeoutMs: 15_000,
  inventoryIntervalMs: 3000,
  readinessTimeoutMs: 90_000,
  readinessRequestTimeoutMs: 2000,
  readinessIntervalMs: 500,
  sourceWatchDebounceMs: 250,
  frontendRequestTimeoutMs: 1500,
  frontendCommandTimeoutMs: 20 * 60_000,
});

export const FRONTEND_AGENT_LIMITS = Object.freeze({
  errorLength: 2000,
  responseBytes: 65_536,
});

export const LOG_LIMITS = Object.freeze({
  bufferCapacity: 5000,
  defaultPageSize: 200,
  maxPageSize: 1000,
  sourceLength: 200,
  searchLength: 1000,
  correlationIdLength: 300,
  cursorsLength: 30_000,
  cursorLength: 100,
  bootstrapLines: 500,
  containerTailLines: 200,
});

export const PROCESS_LIMITS = Object.freeze({
  outputLength: 1_048_576,
  partialLineLength: 65_536,
  operationHistory: 100,
});

export const LOG_SOURCES = Object.freeze({
  orchestration: "orchestration",
  identity: "identity",
});

export const LOG_SOURCE_PREFIXES = Object.freeze({
  infrastructure: "infra:",
  preset: "preset:",
});

export const LOG_SOURCE_GROUPS = Object.freeze({
  packages: "group:packages",
  infrastructure: "group:infra",
  seed: "group:seed",
});

export const LOG_LEVELS = LogEntry.shape.level.options;

export const DASHBOARD_ACTION_TYPES = Object.freeze({
  packagesStart: "packages.start",
  packagesStop: "packages.stop",
  packagesWatch: "packages.watch",
  packageStart: "package.start",
  packageStop: "package.stop",
  packageRestart: "package.restart",
  packageWatch: "package.watch",
  presetStart: "preset.start",
  presetStop: "preset.stop",
  infraStart: "infra.start",
  infraStop: "infra.stop",
  infraReset: "infra.reset",
  seed: "seed",
  seedPrepare: "seed.prepare",
} satisfies Record<string, DashboardAction["type"]>);

export const PACKAGE_NAMES = Object.freeze({
  tenantProcess: "pagopa-interop-tenant-process",
  tenantReadmodelWriter: "pagopa-interop-tenant-readmodel-writer-sql",
  catalogProcess: "pagopa-interop-catalog-process",
  catalogReadmodelWriter: "pagopa-interop-catalog-readmodel-writer-sql",
  backendForFrontend: "pagopa-interop-backend-for-frontend",
  authorizationServer: "pagopa-interop-authorization-server",
});

export const SEED_PACKAGES: readonly string[] = [
  PACKAGE_NAMES.tenantProcess,
  PACKAGE_NAMES.tenantReadmodelWriter,
  PACKAGE_NAMES.catalogProcess,
  PACKAGE_NAMES.catalogReadmodelWriter,
];

export const LOCAL_ENDPOINTS = Object.freeze({
  frontendPublic: "http://localhost:3000",
  selfcare: "http://localhost:8006",
  dynamodb: "http://localhost:8085",
  jwks: "http://127.0.0.1:4500/jwks.json",
  localstack: "http://localhost:4566",
  s3: "http://localhost:9000",
  sqs: "http://localhost:9324",
  ses: "http://localhost:8005",
  tenantProcess: "http://localhost:3500",
  catalogProcess: "http://localhost:3000",
  purposeTemplateProcess: "http://localhost:4300",
  attributeProcess: "http://localhost:3200",
  backendForFrontend: "http://localhost:3600/backend-for-frontend/0.0",
});

export const LOCAL_LOOPBACK_HOSTS: readonly string[] = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
  "0.0.0.0",
];

export const INHERITED_ENVIRONMENT_KEYS: readonly string[] = [
  "PATH",
  "HOME",
  "USER",
  "TMPDIR",
  "TEMP",
  "LANG",
  "PNPM_HOME",
  "CI",
  "NODE_ENV",
  "COMPOSE_PROJECT_NAME",
  "PUPPETEER_SKIP_DOWNLOAD",
  "PUPPETEER_EXECUTABLE_PATH",
  "npm_config_store_dir",
];
