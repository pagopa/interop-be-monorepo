import type {
  DashboardStatus,
  IdentitiesResponse,
  LogsResponse,
  Package,
} from "pagopa-interop-dev-dashboard-contracts";

export function statusFixture(
  overrides: Partial<DashboardStatus> = {}
): DashboardStatus {
  return {
    seedReady: true,
    seedPrerequisites: [],
    seedPackages: [
      "pagopa-interop-tenant-process",
      "pagopa-interop-tenant-readmodel-writer-sql",
      "pagopa-interop-catalog-process",
      "pagopa-interop-catalog-readmodel-writer-sql",
    ],
    packages: [
      {
        name: "pagopa-interop-backend-for-frontend",
        label: "Backend for frontend",
        kind: "service",
        state: "stopped",
        watch: false,
        port: 3600,
      },
      {
        name: "pagopa-interop-catalog-readmodel-writer-sql",
        label: "Catalog readmodel writer",
        kind: "worker",
        state: "running",
        watch: true,
        pid: 123,
      },
      {
        name: "pagopa-interop-tenant-process",
        label: "Tenant process",
        kind: "service",
        state: "stopped",
        watch: false,
      },
    ],
    presets: [
      {
        id: "backend",
        name: "Backend core",
        source: "shared",
        packages: [
          { name: "pagopa-interop-backend-for-frontend", watch: true },
        ],
      },
      {
        id: "personal-core",
        name: "My core",
        source: "personal",
        packages: [
          { name: "pagopa-interop-catalog-readmodel-writer-sql", watch: false },
        ],
      },
    ],
    infrastructure: [{ name: "postgres", state: "running", status: "healthy" }],
    operations: [
      {
        id: "startup",
        kind: "preset.start",
        state: "passed",
        startedAt: "2026-10-06T10:00:00Z",
        phases: [
          { id: "infrastructure", label: "Infrastructure", state: "passed" },
          { id: "build", label: "Build packages", state: "passed" },
          { id: "processes", label: "Start processes", state: "passed" },
        ],
      },
    ],
    logSources: [
      {
        id: "pagopa-interop-backend-for-frontend",
        label: "Backend for frontend",
        kind: "backend",
      },
    ],
    ...overrides,
  };
}

export function seedPackagesFixture(): DashboardStatus {
  const fixture = statusFixture();
  const states: Package["state"][] = [
    "running",
    "stopped",
    "building",
    "failed",
  ];
  return {
    ...fixture,
    operations: [],
    packages: [
      ...fixture.seedPackages.map((name, index) => ({
        ...fixture.packages[2],
        name,
        label: name,
        state: states[index],
        watch: index === 0,
      })),
      fixture.packages[0],
    ],
  };
}

export const emptyLogs: LogsResponse = {
  entries: [],
  cursors: {},
  resetSources: [],
};

export const identitiesFixture: IdentitiesResponse = {
  ready: true,
  tenants: [
    {
      key: "consumer",
      id: "tenant-consumer",
      selfcareId: "selfcare-consumer",
      name: "Consumer tenant",
      users: [
        {
          key: "admin",
          id: "admin",
          name: "Anna",
          surname: "Rossi",
          email: "anna@example.test",
          roles: ["admin"],
        },
      ],
    },
    {
      key: "producer",
      id: "tenant-producer",
      selfcareId: "selfcare-producer",
      name: "Producer tenant",
      users: [
        {
          key: "operator",
          id: "operator",
          name: "Luca",
          surname: "Verdi",
          email: "luca@example.test",
          roles: ["operator"],
        },
      ],
    },
  ],
};
