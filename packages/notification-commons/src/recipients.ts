import {
  getLatestTenantMailOfKind,
  Logger,
  notificationAdmittedRoles,
} from "pagopa-interop-commons";
import {
  EmailNotificationMessagePayload,
  EmailNotificationRecipientPayload,
  NotificationType,
  tenantMailKind,
  Tenant,
  TenantId,
  UserId,
} from "pagopa-interop-models";

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

const getTenantRecipientIfEnabled = async (
  tenant: Tenant,
  readModelService: EmailNotificationReadModelService,
  logger: Logger
): Promise<TenantEmailNotificationRecipient | undefined> => {
  const tenantConfig =
    await readModelService.getTenantNotificationConfigByTenantId(tenant.id);
  if (tenantConfig === undefined) {
    logger.warn(`No notification configuration found for tenant ${tenant.id}.`);
    return undefined;
  }
  if (tenantConfig.enabled === false) {
    return undefined;
  }
  const recipient = {
    type: "Tenant" as const,
    tenantId: tenant.id,
    selfcareId: tenant.selfcareId,
  };
  if (tenant.contactId) {
    return { ...recipient, contactId: tenant.contactId };
  }
  const email = getLatestTenantMailOfKind(
    tenant.mails,
    tenantMailKind.ContactEmail
  );
  if (email === undefined) {
    logger.warn(`No contact email found for tenant ${tenant.id}.`);
    return undefined;
  }
  return { ...recipient, address: email.address };
};

export async function getNotificationRecipients(
  tenantIds: TenantId[],
  notificationType: NotificationType,
  readModelService: NotificationReadModelService,
  logger: Logger,
  notificationTypeBlocklist?: NotificationType[]
): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
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

  const tenantRecipients = includeTenantContactEmails
    ? await Promise.all(
        tenants.map((tenant) =>
          getTenantRecipientIfEnabled(tenant, readModelService, logger)
        )
      )
    : [];

  return [
    ...userRecipients,
    ...tenantRecipients.filter(
      (t): t is TenantEmailNotificationRecipient => t !== undefined
    ),
  ];
};

export const mapRecipientToEmailPayload = (
  recipient: EmailNotificationRecipientPayload
): EmailNotificationRecipientPayload => {
  if (recipient.type === "User") {
    return { type: recipient.type, userId: recipient.userId };
  }
  return recipient.contactId !== undefined
    ? { type: recipient.type, contactId: recipient.contactId }
    : { type: recipient.type, address: recipient.address };
};

export function encodeEmailEvent(
  event: EmailNotificationMessagePayload
): string {
  return JSON.stringify({
    correlationId: event.correlationId,
    email: {
      subject: event.email.subject,
      body: event.email.body,
    },
    tenantId: event.tenantId,
    ...mapRecipientToEmailPayload(event),
  });
}
