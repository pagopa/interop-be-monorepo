import { Logger, userRole, UserRole } from "pagopa-interop-commons";
import {
  SelfcareV2InstitutionClient,
  notificationConfigApi,
} from "pagopa-interop-api-clients";
import {
  DrizzleReturnType,
  TenantSQL,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { isNotNull } from "drizzle-orm";
import { match } from "ts-pattern";
import { CreateDefaultUserNotificationConfigConfig } from "./config/config.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

  const tenants = await db
    .select()
    .from(tenantInReadmodelTenant)
    .where(isNotNull(tenantInReadmodelTenant.selfcareId));

  logger.info(`Found ${tenants.length} tenants with selfcareId`);

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

  for (const user of users) {
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

  logger.info(
    `Processing user ${user.id} for tenant ${
      tenant.id
    } with roles: ${roles.join(", ")}`
  );

  for (const role of roles) {
    const mappedRole = UserRole.safeParse(role);

    if (!mappedRole.success) {
      logger.warn(
        `Unknown role ${role} for user ${user.id}, tenant ${tenant.id}, skipping`
      );
      continue;
    }

    await ensureUserNotificationConfig(
      user.id,
      tenant.id,
      mappedRole.data,
      internalToken,
      notificationConfigClient,
      logger
    );

    await sleep(config.notificationConfigCallDelayMs);
  }
}

// eslint-disable-next-line max-params
async function ensureUserNotificationConfig(
  userId: string,
  tenantId: string,
  userRole: UserRole,
  internalToken: string,
  notificationConfigClient: ReturnType<
    typeof notificationConfigApi.createProcessApiClient
  >,
  logger: Logger
): Promise<void> {
  try {
    await notificationConfigClient.ensureUserNotificationConfigExistsWithRole(
      {
        userId,
        tenantId,
        userRole: userRoleToApiUserRole(userRole),
      },
      {
        headers: {
          "X-Correlation-Id": `create-default-${userId}-${Date.now()}`,
          Authorization: `Bearer ${internalToken}`,
        },
      }
    );

    logger.info(
      `Successfully ensured notification config for user ${userId}, tenant ${tenantId}, role ${userRoleToApiUserRole(
        userRole
      )}`
    );
  } catch (error) {
    logger.error(
      `Failed to ensure notification config for user ${userId}, tenant ${tenantId}, role ${userRole}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}
