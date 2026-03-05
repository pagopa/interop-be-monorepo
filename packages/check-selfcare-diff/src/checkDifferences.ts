import { isNotNull } from "drizzle-orm";
import pLimit from "p-limit";
import { SelfcareV2InstitutionClient } from "pagopa-interop-api-clients";
import {
  generateId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
  tenantNotificationConfigInReadmodelNotificationConfig,
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

type TenantOriginMismatch = {
  field: "origin" | "originId";
  dbValue: string;
  selfcareValue: string | undefined;
};

type UserDifferences = {
  missingInConfig: Array<{ userId: string; selfcareRoles: string[] }>;
  extraInConfig: Array<{ userId: string; configRoles: string[] }>;
  roleMismatches: Array<{
    userId: string;
    selfcareRoles: string[];
    configRoles: string[];
  }>;
};

type TenantDiff = {
  tenantId: string;
  tenantName: string;
  selfcareId: string;
  userDifferences: UserDifferences;
  tenantDataMismatches: TenantOriginMismatch[];
  selfcareInstitutionType?: string;
  hasTenantNotificationConfig: boolean;
};

type DiffResult = {
  tenants: TenantDiff[];
  tenantsMissingNotificationConfig: Array<{
    tenantId: string;
    tenantName: string;
    selfcareId: string;
  }>;
  summary: {
    totalTenants: number;
    tenantsWithDifferences: number;
    totalMissingInConfig: number;
    totalExtraInConfig: number;
    totalRoleMismatches: number;
    tenantsWithOriginMismatches: number;
    totalOriginMismatches: number;
    tenantsMissingNotificationConfig: number;
  };
};

/**
 * Derives the expected origin and originId from SelfCare data,
 * applying the same transformations used by the onboarding consumer:
 * - origin: SCP/PRV/PT institution types get a suffix appended
 * - originId: non-IPA origins prefer taxCode over originId
 */
function deriveExpectedExternalId(institution: {
  origin?: string;
  originId?: string;
  institutionType?: string;
  taxCode?: string;
}): { origin: string | undefined; originId: string | undefined } {
  const suffixedTypes = ["SCP", "PRV", "PT"];
  const origin =
    institution.origin &&
    institution.institutionType &&
    suffixedTypes.includes(institution.institutionType)
      ? `${institution.origin}-${institution.institutionType}`
      : institution.origin;

  const originId =
    institution.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
      ? institution.originId
      : institution.taxCode || institution.originId;

  return { origin, originId };
}

function checkOriginMismatches(
  dbOrigin: string,
  dbOriginId: string,
  expectedOrigin: string | undefined,
  expectedOriginId: string | undefined
): TenantOriginMismatch[] {
  const mismatches: TenantOriginMismatch[] = [];

  if (dbOrigin !== expectedOrigin) {
    // eslint-disable-next-line functional/immutable-data
    mismatches.push({
      field: "origin",
      dbValue: dbOrigin,
      selfcareValue: expectedOrigin,
    });
  }

  if (dbOriginId !== expectedOriginId) {
    // eslint-disable-next-line functional/immutable-data
    mismatches.push({
      field: "originId",
      dbValue: dbOriginId,
      selfcareValue: expectedOriginId,
    });
  }

  return mismatches;
}

function computeUserDifferences(
  selfcareUserMap: Map<string, string[]>,
  configUserMap: Map<string, string[]>
): UserDifferences {
  const missingInConfig: UserDifferences["missingInConfig"] = [];
  const extraInConfig: UserDifferences["extraInConfig"] = [];
  const roleMismatches: UserDifferences["roleMismatches"] = [];

  for (const [userId, selfcareRoles] of selfcareUserMap) {
    const configRoles = configUserMap.get(userId);
    if (!configRoles) {
      // eslint-disable-next-line functional/immutable-data
      missingInConfig.push({ userId, selfcareRoles });
    } else if (JSON.stringify(selfcareRoles) !== JSON.stringify(configRoles)) {
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

  return { missingInConfig, extraInConfig, roleMismatches };
}

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
      externalIdOrigin: tenantInReadmodelTenant.externalIdOrigin,
      externalIdValue: tenantInReadmodelTenant.externalIdValue,
    })
    .from(tenantInReadmodelTenant)
    .where(isNotNull(tenantInReadmodelTenant.selfcareId));

  // Pre-fetch all tenant notification configs for O(1) lookup
  const tenantNotificationConfigs = await db
    .select({
      tenantId: tenantNotificationConfigInReadmodelNotificationConfig.tenantId,
      enabled: tenantNotificationConfigInReadmodelNotificationConfig.enabled,
    })
    .from(tenantNotificationConfigInReadmodelNotificationConfig);

  const tenantNotificationConfigMap = new Map<string, boolean>(
    tenantNotificationConfigs.map((c) => [c.tenantId, c.enabled])
  );

  // Pre-fetch all user notification configs for O(1) lookup per tenant
  const allUserNotificationConfigs = await db
    .select({
      tenantId: userNotificationConfigInReadmodelNotificationConfig.tenantId,
      userId: userNotificationConfigInReadmodelNotificationConfig.userId,
      userRoles: userNotificationConfigInReadmodelNotificationConfig.userRoles,
    })
    .from(userNotificationConfigInReadmodelNotificationConfig);

  const userNotificationConfigMap = new Map<
    string,
    Array<{ userId: string; userRoles: string[] }>
  >();
  for (const c of allUserNotificationConfigs) {
    const existing = userNotificationConfigMap.get(c.tenantId) ?? [];
    // eslint-disable-next-line functional/immutable-data
    existing.push({ userId: c.userId, userRoles: c.userRoles });
    userNotificationConfigMap.set(c.tenantId, existing);
  }

  const limit = pLimit(config.selfcareApiConcurrency);

  const processTenant = async (
    tenant: (typeof tenants)[number]
  ): Promise<{
    diff: TenantDiff | null;
    missingNotificationConfig: boolean;
  }> => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const selfcareId = tenant.selfcareId!;

    const hasTenantNotificationConfig = tenantNotificationConfigMap.has(
      tenant.id
    );

    // Fetch selfcare users and institution data in parallel
    const [selfcareUsers, institutionData] = await Promise.all([
      selfcareClient.getInstitutionUsersByProductUsingGET({
        params: { institutionId: selfcareId },
        queries: { productId: config.interopProduct },
        headers: { "X-Correlation-Id": generateId() },
      }),
      selfcareClient.retrieveInstitutionByIdUsingGET({
        params: { id: selfcareId },
        headers: { "X-Correlation-Id": generateId() },
      }),
    ]);

    const expectedExternalId = deriveExpectedExternalId(institutionData);

    const tenantDataMismatches = checkOriginMismatches(
      tenant.externalIdOrigin,
      tenant.externalIdValue,
      expectedExternalId.origin,
      expectedExternalId.originId
    );

    const mergedSelfcareUsers = mergeUsersByIdWithRoles(
      selfcareUsers.map((u) => ({ id: u.id, roles: u.roles }))
    );

    const notificationConfigs = userNotificationConfigMap.get(tenant.id) ?? [];

    const selfcareUserMap = new Map<string, string[]>(
      mergedSelfcareUsers.map((u) => [u.id, u.roles])
    );
    const configUserMap = new Map<string, string[]>(
      notificationConfigs.map((c) => [c.userId, [...c.userRoles].sort()])
    );

    const userDifferences = computeUserDifferences(
      selfcareUserMap,
      configUserMap
    );

    const hasUserDifferences =
      userDifferences.missingInConfig.length > 0 ||
      userDifferences.extraInConfig.length > 0 ||
      userDifferences.roleMismatches.length > 0;

    const hasAnyDifference =
      hasUserDifferences ||
      tenantDataMismatches.length > 0 ||
      !hasTenantNotificationConfig;

    if (hasAnyDifference) {
      return {
        diff: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          selfcareId,
          userDifferences,
          tenantDataMismatches,
          selfcareInstitutionType: institutionData.institutionType,
          hasTenantNotificationConfig,
        },
        missingNotificationConfig: !hasTenantNotificationConfig,
      };
    }

    return { diff: null, missingNotificationConfig: false };
  };

  const results = await Promise.all(
    tenants.map((tenant) => limit(() => processTenant(tenant)))
  );

  const tenantsWithDiffs: TenantDiff[] = [];
  const tenantsMissingNotificationConfig: DiffResult["tenantsMissingNotificationConfig"] =
    [];

  // eslint-disable-next-line functional/no-let
  let totalMissing = 0;
  // eslint-disable-next-line functional/no-let
  let totalExtra = 0;
  // eslint-disable-next-line functional/no-let
  let totalMismatches = 0;
  // eslint-disable-next-line functional/no-let
  let tenantsWithOriginMismatches = 0;
  // eslint-disable-next-line functional/no-let
  let totalOriginMismatches = 0;

  for (const result of results) {
    if (result.diff) {
      // eslint-disable-next-line functional/immutable-data
      tenantsWithDiffs.push(result.diff);
      totalMissing += result.diff.userDifferences.missingInConfig.length;
      totalExtra += result.diff.userDifferences.extraInConfig.length;
      totalMismatches += result.diff.userDifferences.roleMismatches.length;

      if (result.diff.tenantDataMismatches.length > 0) {
        tenantsWithOriginMismatches++;
        totalOriginMismatches += result.diff.tenantDataMismatches.length;
      }

      if (result.missingNotificationConfig) {
        // eslint-disable-next-line functional/immutable-data
        tenantsMissingNotificationConfig.push({
          tenantId: result.diff.tenantId,
          tenantName: result.diff.tenantName,
          selfcareId: result.diff.selfcareId,
        });
      }
    }
  }

  return {
    tenants: tenantsWithDiffs,
    tenantsMissingNotificationConfig,
    summary: {
      totalTenants: tenants.length,
      tenantsWithDifferences: tenantsWithDiffs.length,
      totalMissingInConfig: totalMissing,
      totalExtraInConfig: totalExtra,
      totalRoleMismatches: totalMismatches,
      tenantsWithOriginMismatches,
      totalOriginMismatches,
      tenantsMissingNotificationConfig: tenantsMissingNotificationConfig.length,
    },
  };
}
