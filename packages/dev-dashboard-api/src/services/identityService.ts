import type {
  IdentityInput,
  IdentitiesResponse,
  SessionResponse,
} from "pagopa-interop-dev-dashboard-contracts";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DASHBOARD_PATHS,
  DASHBOARD_TIMING,
  LOCAL_ENDPOINTS,
  LOG_SOURCES,
} from "../config/constants.js";
import {
  LocalDataset,
  LocalSeedState,
  type Driver,
} from "../model/domain/models.js";
import { isFileNotFoundError } from "../utilities/errorUtils.js";

export type IdentityService = {
  identities(): Promise<IdentitiesResponse>;
  identity(input: IdentityInput): Promise<SessionResponse>;
};

type Dataset = ReturnType<typeof LocalDataset.parse>;
type TenantUser = {
  user: Dataset["users"][number];
  roles: string[];
};

function groupTenantUsers(users: Dataset["users"]): Map<string, TenantUser[]> {
  const bySelfcareId = new Map<string, TenantUser[]>();
  users.forEach((user) => {
    const memberships = new Set<string>();
    user.memberships.forEach(({ tenantSelfcareId, roles }) => {
      if (!memberships.has(tenantSelfcareId)) {
        memberships.add(tenantSelfcareId);
        const group = bySelfcareId.get(tenantSelfcareId) ?? [];
        group.push({ user, roles });
        bySelfcareId.set(tenantSelfcareId, group);
      }
    });
  });
  return bySelfcareId;
}

async function readSeedState(root: string): Promise<LocalSeedState> {
  try {
    return LocalSeedState.parse(
      JSON.parse(await readFile(join(root, DASHBOARD_PATHS.seedState), "utf8"))
    );
  } catch (error) {
    if (!isFileNotFoundError(error)) throw error;
    return { tenants: {} };
  }
}

export function identityServiceBuilder(
  beRoot: string,
  driver: Driver
): IdentityService {
  let selections: Promise<void> = Promise.resolve();

  async function identities(): Promise<IdentitiesResponse> {
    const dataset = LocalDataset.parse(
      JSON.parse(await readFile(join(beRoot, DASHBOARD_PATHS.dataset), "utf8"))
    );
    const state = await readSeedState(beRoot);
    const ready = dataset.tenants.every((tenant) =>
      Boolean(state.tenants[tenant.key]?.id)
    );
    const usersBySelfcareId = groupTenantUsers(dataset.users);
    const tenants = dataset.tenants.flatMap((tenant) => {
      const seeded = state.tenants[tenant.key];
      if (!seeded?.id) return [];
      return [
        {
          ...tenant,
          id: seeded.id,
          users: (usersBySelfcareId.get(tenant.selfcareId) ?? []).map(
            ({ user, roles }) => ({
              id: user.id,
              key: user.key,
              name: user.name,
              surname: user.surname,
              email: user.email,
              roles,
            })
          ),
        },
      ];
    });
    return { ready, tenants };
  }

  async function identity(input: IdentityInput): Promise<SessionResponse> {
    const selection = selections.then(() => issueToken(input));
    selections = selection.then(
      () => undefined,
      () => undefined
    );
    return selection;
  }

  async function issueToken(input: IdentityInput): Promise<SessionResponse> {
    const data = await identities();
    const tenant = data.tenants.find((t) => t.key === input.tenantKey);
    if (!data.ready || !tenant?.users.some((u) => u.id === input.userId))
      throw new Error("Unknown or unseeded local identity");
    const command = {
      source: LOG_SOURCES.identity,
      executable: "node",
      args: [
        join(beRoot, DASHBOARD_PATHS.localCli),
        "token",
        "--tenant",
        input.tenantKey,
        "--user",
        input.userId,
      ],
      cwd: beRoot,
      privateOutput: true,
      timeoutMs: DASHBOARD_TIMING.identityCommandTimeoutMs,
      env: { LOCAL_KMS_ENDPOINT: LOCAL_ENDPOINTS.localstack },
    };
    const sessionToken = (await driver.run(command, () => undefined)).trim();
    if (!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(sessionToken))
      throw new Error("Local CLI returned an invalid session token");
    return { sessionToken };
  }

  return {
    identities,
    identity,
  };
}
