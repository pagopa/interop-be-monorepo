import { Logger, userRole, UserRole } from "pagopa-interop-commons";
import {
  SelfcareV2InstitutionClient,
  notificationConfigApi,
} from "pagopa-interop-api-clients";
import {
  DrizzleReturnType,
  TenantSQL,
  tenantInReadmodelTenant,
  userNotificationConfigInReadmodelNotificationConfig,
} from "pagopa-interop-readmodel-models";
import { and, isNotNull, notInArray } from "drizzle-orm";
import { match } from "ts-pattern";
import { CreateDefaultUserNotificationConfigConfig } from "./config/config.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type UserWithRoles = { id: string; roles?: string[] };

/**
 * Merges users with the same ID into a single user with combined roles.
 * This handles the case where the Selfcare API returns multiple entries
 * for the same user with different roles.
 */
export function mergeUsersByIdWithRoles(
  users: UserWithRoles[]
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
    roles: Array.from(rolesSet),
  }));
}

export function userRoleToApiUserRole(
  role: UserRole
): notificationConfigApi.UserRole {
  return match(role)
    .with(userRole.ADMIN_ROLE, () => "ADMIN" as const)
    .with(userRole.API_ROLE, () => "API" as const)
    .with(userRole.SECURITY_ROLE, () => "SECURITY" as const)
    .with(userRole.SUPPORT_ROLE, () => "SUPPORT" as const)
    .exhaustive();
}

export async function processTenantsUsers(
  db: DrizzleReturnType,
  selfcareInstitutionClient: SelfcareV2InstitutionClient,
  notificationConfigClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  config: CreateDefaultUserNotificationConfigConfig,
  logger: Logger
): Promise<void> {
  logger.info("Starting to process tenants and users");

  // Get all tenant IDs that already have user notification configs
  const existingTenantConfigs = await db
    .selectDistinct({
      tenantId: userNotificationConfigInReadmodelNotificationConfig.tenantId,
    })
    .from(userNotificationConfigInReadmodelNotificationConfig);

  const existingTenantIds = existingTenantConfigs.map((c) => c.tenantId);

  logger.info(
    `Found ${existingTenantIds.length} tenants with existing notification configs, excluding them`
  );

  // Get all tenants with selfcareId, excluding those that already have notification configs
  const tenants =
    existingTenantIds.length > 0
      ? await db
          .select()
          .from(tenantInReadmodelTenant)
          .where(
            and(
              isNotNull(tenantInReadmodelTenant.selfcareId),
              notInArray(tenantInReadmodelTenant.id, existingTenantIds)
            )
          )
      : await db
          .select()
          .from(tenantInReadmodelTenant)
          .where(isNotNull(tenantInReadmodelTenant.selfcareId));

  logger.info(`Found ${tenants.length} tenants with selfcareId to process`);

  for (const tenant of tenants) {
    await processTenant(
      tenant,
      selfcareInstitutionClient,
      notificationConfigClient,
      config,
      logger
    );
  }

  logger.info("Completed processing all tenants and users");
}

async function processTenant(
  tenant: TenantSQL,
  selfcareInstitutionClient: SelfcareV2InstitutionClient,
  notificationConfigClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  config: CreateDefaultUserNotificationConfigConfig,
  logger: Logger
): Promise<void> {
  if (!tenant.selfcareId) {
    logger.warn(`Tenant ${tenant.id} has no selfcareId, skipping`);
    return;
  }

  logger.info(
    `Processing tenant ${tenant.id} (selfcareId: ${tenant.selfcareId})`
  );

  const users = await selfcareInstitutionClient
    .getInstitutionUsersByProductUsingGET({
      params: { institutionId: tenant.selfcareId },
      queries: { productId: config.interopProduct },
    })
    .catch((error: unknown) => {
      logger.error(
        `Failed to get users for tenant ${tenant.id} from selfcare: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    });

  logger.info(
    `Found ${users.length} users for tenant ${tenant.id} (selfcareId: ${tenant.selfcareId})`
  );

  // Merge users with the same ID to combine their roles
  const mergedUsers = mergeUsersByIdWithRoles(users);

  logger.info(
    `Merged into ${mergedUsers.length} unique users for tenant ${tenant.id}`
  );

  for (const user of mergedUsers) {
    await processUser(
      user,
      tenant,
      config.internalToken,
      notificationConfigClient,
      config,
      logger
    );
  }
}

// eslint-disable-next-line max-params
async function processUser(
  user: { id: string; roles?: string[] },
  tenant: TenantSQL,
  internalToken: string,
  notificationConfigClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  config: CreateDefaultUserNotificationConfigConfig,
  logger: Logger
): Promise<void> {
  const roles = user.roles || [];

  if (roles.length === 0) {
    logger.warn(
      `User ${user.id} has no roles for tenant ${tenant.id}, skipping`
    );
    return;
  }

  // Collect all valid roles first
  const validRoles = roles.reduce<UserRole[]>((acc, role) => {
    const mappedRole = UserRole.safeParse(role);
    if (mappedRole.success) {
      return [...acc, mappedRole.data];
    }
    logger.warn(
      `Unknown role ${role} for user ${user.id}, tenant ${tenant.id}, skipping`
    );
    return acc;
  }, []);

  if (validRoles.length === 0) {
    logger.warn(
      `User ${user.id} has no valid roles for tenant ${tenant.id}, skipping`
    );
    return;
  }

  logger.info(
    `Processing user ${user.id} for tenant ${
      tenant.id
    } with roles: ${validRoles.join(", ")}`
  );

  // Make a single call with all roles to avoid race conditions
  await ensureUserNotificationConfig(
    user.id,
    tenant.id,
    validRoles,
    internalToken,
    notificationConfigClient,
    logger
  );

  await sleep(config.notificationConfigCallDelayMs);
}

// eslint-disable-next-line max-params
async function ensureUserNotificationConfig(
  userId: string,
  tenantId: string,
  userRoles: UserRole[],
  internalToken: string,
  notificationConfigClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  logger: Logger
): Promise<void> {
  const apiRoles = userRoles.map(userRoleToApiUserRole);
  try {
    await notificationConfigClient.ensureUserNotificationConfigExistsWithRoles(
      {
        userId,
        tenantId,
        userRoles: apiRoles,
      },
      {
        headers: {
          "X-Correlation-Id": `create-default-${userId}-${Date.now()}`,
          Authorization: `Bearer ${internalToken}`,
        },
      }
    );

    logger.info(
      `Successfully ensured notification config for user ${userId}, tenant ${tenantId}, roles ${apiRoles.join(
        ", "
      )}`
    );
  } catch (error) {
    logger.error(
      `Failed to ensure notification config for user ${userId}, tenant ${tenantId}, roles ${apiRoles.join(
        ", "
      )}: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
