import { eq, isNotNull } from "drizzle-orm";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { CheckDiffConfig } from "./config/config.js";

type UserWithRoles = { id: string; roles: string[] };

function mergeUsersByIdWithRoles(
  users: Array<{ id: string; roles?: string[] }>
): UserWithRoles[] {
  const userMap = new Map<string, Set<string>>();

  for (const user of users) {
    const existingRoles = userMap.get(user.id) ?? new Set<string>();
    for (const role of user.roles ?? []) {
      existingRoles.add(role);
    }
    userMap.set(user.id, existingRoles);
  }

  return Array.from(userMap.entries()).map(([id, rolesSet]) => ({
    id,
    roles: Array.from(rolesSet).sort(),
  }));
}

type TenantDiff = {
  tenantId: string;
  tenantName: string;
  selfcareId: string;
  differences: {
    missingInConfig: Array<{ userId: string; selfcareRoles: string[] }>;
    extraInConfig: Array<{ userId: string; configRoles: string[] }>;
    roleMismatches: Array<{
      userId: string;
      selfcareRoles: string[];
      configRoles: string[];
    }>;
  };
};

type DiffResult = {
  tenants: TenantDiff[];
  summary: {
    totalTenants: number;
    tenantsWithDifferences: number;
    totalMissingInConfig: number;
    totalExtraInConfig: number;
    totalRoleMismatches: number;
  };
};

export async function checkDifferences(
  db: DrizzleReturnType,
  selfcareClient: SelfcareV2InstitutionClient,
  config: CheckDiffConfig
): Promise<DiffResult> {
  const tenants = await db
    .select({
      id: tenantInReadmodelTenant.id,
      name: tenantInReadmodelTenant.name,
      selfcareId: tenantInReadmodelTenant.selfcareId,
    })
    .from(tenantInReadmodelTenant)
    .where(isNotNull(tenantInReadmodelTenant.selfcareId));

  const tenantsWithDiffs: TenantDiff[] = [];
  // eslint-disable-next-line functional/no-let
  let totalMissing = 0;
  // eslint-disable-next-line functional/no-let
  let totalExtra = 0;
  // eslint-disable-next-line functional/no-let
  let totalMismatches = 0;

  for (const tenant of tenants) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const selfcareId = tenant.selfcareId!;

    const selfcareUsers =
      await selfcareClient.getInstitutionUsersByProductUsingGET({
        params: { institutionId: selfcareId },
        queries: { productId: config.interopProduct },
        headers: { "X-Correlation-Id": generateId() },
      });

    const mergedSelfcareUsers = mergeUsersByIdWithRoles(
      selfcareUsers.map((u) => ({ id: u.id, roles: u.roles }))
    );

    const notificationConfigs = await db
      .select({
        userId: userNotificationConfigInReadmodelNotificationConfig.userId,
        userRoles:
          userNotificationConfigInReadmodelNotificationConfig.userRoles,
      })
      .from(userNotificationConfigInReadmodelNotificationConfig)
      .where(
        eq(
          userNotificationConfigInReadmodelNotificationConfig.tenantId,
          tenant.id
        )
      );

    const selfcareUserMap = new Map<string, string[]>(
      mergedSelfcareUsers.map((u) => [u.id, u.roles])
    );
    const configUserMap = new Map<string, string[]>(
      notificationConfigs.map((c) => [c.userId, [...c.userRoles].sort()])
    );

    const missingInConfig: TenantDiff["differences"]["missingInConfig"] = [];
    const extraInConfig: TenantDiff["differences"]["extraInConfig"] = [];
    const roleMismatches: TenantDiff["differences"]["roleMismatches"] = [];

    for (const [userId, selfcareRoles] of selfcareUserMap) {
      const configRoles = configUserMap.get(userId);
      if (!configRoles) {
        // eslint-disable-next-line functional/immutable-data
        missingInConfig.push({ userId, selfcareRoles });
      } else if (
        JSON.stringify(selfcareRoles) !== JSON.stringify(configRoles)
      ) {
        // eslint-disable-next-line functional/immutable-data
        roleMismatches.push({ userId, selfcareRoles, configRoles });
      }
    }

    for (const [userId, configRoles] of configUserMap) {
      if (!selfcareUserMap.has(userId)) {
        // eslint-disable-next-line functional/immutable-data
        extraInConfig.push({ userId, configRoles });
      }
    }

    if (
      missingInConfig.length > 0 ||
      extraInConfig.length > 0 ||
      roleMismatches.length > 0
    ) {
      // eslint-disable-next-line functional/immutable-data
      tenantsWithDiffs.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        selfcareId,
        differences: { missingInConfig, extraInConfig, roleMismatches },
      });
      totalMissing += missingInConfig.length;
      totalExtra += extraInConfig.length;
      totalMismatches += roleMismatches.length;
    }
  }

  return {
    tenants: tenantsWithDiffs,
    summary: {
      totalTenants: tenants.length,
      tenantsWithDifferences: tenantsWithDiffs.length,
      totalMissingInConfig: totalMissing,
      totalExtraInConfig: totalExtra,
      totalRoleMismatches: totalMismatches,
    },
  };
}
