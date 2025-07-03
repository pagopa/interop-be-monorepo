import {
  EService,
  Descriptor,
  descriptorState,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { notification } from "pagopa-interop-in-app-notification-db-models";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import {
  descriptorPublishedNotFound,
  tenantNotFound,
} from "../models/errors.js";

export async function retrieveTenant(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
}

export async function insertNotifications(
  userNotificationConfigs: Array<{
    userId: string;
    tenantId: string;
    body: string;
    deepLink: string;
  }>,
  notificationDB: ReturnType<typeof drizzle>
): Promise<void> {
  if (userNotificationConfigs.length === 0) {
    return;
  }
  await notificationDB.insert(notification).values(
    userNotificationConfigs.map(({ userId, tenantId, body, deepLink }) => ({
      id: generateId(),
      tenantId,
      userId,
      body,
      deepLink,
      createdAt: new Date().toISOString(),
      readAt: null,
    }))
  );
}

export function retrieveLatestPublishedDescriptor(
  eservice: EService
): Descriptor {
  const latestDescriptor = eservice.descriptors
    .filter((d) => d.state === descriptorState.published)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (!latestDescriptor) {
    throw descriptorPublishedNotFound(eservice.id);
  }
  return latestDescriptor;
}
