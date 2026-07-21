import {
  getLatestTenantMailOfKind,
  Logger,
  notificationAdmittedRoles,
} from "pagopa-interop-commons";
import {
  NotificationType,
  tenantMailKind,
  Tenant,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import {
  EmailNotificationReadModelService,
  EmailNotificationRecipient,
  NotificationReadModelService,
  TenantEmailNotificationRecipient,
  UserEmailNotificationRecipient,
} from "./types.js";

const getNotificationTypeBlocklist = ({
  notificationTypeBlocklist,
  readModelService,
}: {
  notificationTypeBlocklist?: NotificationType[];
  readModelService: NotificationReadModelService;
}): NotificationType[] =>
  notificationTypeBlocklist ?? readModelService.notificationTypeBlocklist ?? [];

const getTenantContactEmailIfEnabled = async (
  tenant: Tenant,
  readModelService: EmailNotificationReadModelService,
  logger: Logger
): Promise<string | undefined> => {
  const tenantConfig =
    await readModelService.getTenantNotificationConfigByTenantId(tenant.id);
  if (tenantConfig === undefined) {
    logger.warn(`No notification configuration found for tenant ${tenant.id}.`);
    return undefined;
  }
  if (tenantConfig.enabled === false) {
    return undefined;
  }
  const email = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.ContactEmail
  );
  if (email === undefined) {
    logger.warn(`No contact email found for tenant ${tenant.id}.`);
    return undefined;
  }
  return email.address;
};

export async function getNotificationRecipients(
  tenantIds: TenantId[],
  notificationType: NotificationType,
  readModelService: NotificationReadModelService,
  logger: Logger,
  notificationTypeBlocklist?: NotificationType[]
): Promise<{ userId: UserId; tenantId: TenantId }[]> {
  if (
    getNotificationTypeBlocklist({
      notificationTypeBlocklist,
      readModelService,
    }).includes(notificationType)
  ) {
    logger.info(
      `Notification type ${notificationType} is in the blocklist - skipping notifications for tenants with id: ${tenantIds.join(
        ","
      )}`
    );
    return [];
  }

  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenantIds,
      notificationType,
      "inApp"
    );
  return usersWithNotifications.filter(({ userId, tenantId, userRoles }) => {
    const userCanReceiveNotification = userRoles.some(
      (r) => notificationAdmittedRoles[notificationType][r]
    );
    if (!userCanReceiveNotification) {
      logger.warn(
        `Discarding notification for user ${userId} in ${tenantId} due to missing roles (notification type: ${notificationType}, user roles: ${userRoles.join(
          ", "
        )})`
      );
    }
    return userCanReceiveNotification;
  });
}

export const getRecipientsForTenants = async ({
  tenants,
  notificationType,
  includeTenantContactEmails,
  readModelService,
  logger,
  notificationTypeBlocklist,
}: {
  tenants: Tenant[];
  notificationType: NotificationType;
  includeTenantContactEmails: boolean;
  readModelService: EmailNotificationReadModelService;
  logger: Logger;
  notificationTypeBlocklist?: NotificationType[];
}): Promise<EmailNotificationRecipient[]> => {
  if (
    getNotificationTypeBlocklist({
      notificationTypeBlocklist,
      readModelService,
    }).includes(notificationType)
  ) {
    logger.info(
      `Notification type ${notificationType} is in the blocklist. Skipping notification for tenants with ids: ${tenants
        .map((t) => t.id)
        .join(",")}`
    );
    return [];
  }

  const tenantSelfcareIdMap = new Map<TenantId, string | undefined>(
    tenants.map((tenant) => [tenant.id, tenant.selfcareId])
  );

  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenants.map((tenant) => tenant.id),
      notificationType,
      "email"
    );

  const userRecipients: UserEmailNotificationRecipient[] = tenantUsers
    .filter(({ userId, tenantId, userRoles }) => {
      const userCanReceiveNotification = userRoles.some(
        (r) => notificationAdmittedRoles[notificationType][r]
      );
      if (!userCanReceiveNotification) {
        logger.warn(
          `Discarding notification for user ${userId} in ${tenantId} due to missing roles (notification type: ${notificationType}, user roles: ${userRoles.join(
            ", "
          )})`
        );
      }
      return userCanReceiveNotification;
    })
    .map(({ userId, tenantId }) => ({
      type: "User" as const,
      userId,
      tenantId,
      selfcareId: tenantSelfcareIdMap.get(tenantId),
    }));

  const tenantRecipients: TenantEmailNotificationRecipient[] =
    includeTenantContactEmails
      ? (
          await Promise.all(
            tenants.map(async (tenant) => ({
              type: "Tenant" as const,
              tenantId: tenant.id,
              selfcareId: tenant.selfcareId,
              address: await getTenantContactEmailIfEnabled(
                tenant,
                readModelService,
                logger
              ),
            }))
          )
        ).filter(
          (t): t is TenantEmailNotificationRecipient => t.address !== undefined
        )
      : [];

  return [...userRecipients, ...tenantRecipients];
};

export const mapRecipientToEmailPayload = (
  recipient: EmailNotificationRecipient
): { type: "User"; userId: UserId } | { type: "Tenant"; address: string } =>
  match(recipient)
    .with({ type: "User" }, ({ type, userId }) => ({
      type,
      userId,
    }))
    .with({ type: "Tenant" }, ({ type, address }) => ({
      type,
      address,
    }))
    .exhaustive();
