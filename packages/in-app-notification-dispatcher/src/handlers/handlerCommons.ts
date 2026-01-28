import {
  EService,
  Descriptor,
  Attribute,
  AttributeId,
  Tenant,
  TenantId,
  EServiceId,
  PurposeId,
  Purpose,
  NotificationType,
  UserId,
  descriptorState,
} from "pagopa-interop-models";
import { Logger, notificationAdmittedRoles } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import {
  attributeNotFound,
  certifierTenantNotFound,
  eserviceNotFound,
  eserviceWithoutDescriptors,
  purposeNotFound,
  tenantNotFound,
} from "../models/errors.js";
import { config } from "../config/config.js";

export async function getNotificationRecipients(
  tenantIds: TenantId[],
  notificationType: NotificationType,
  readModelService: ReadModelServiceSQL,
  logger: Logger
): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
  if (config.notificationTypeBlocklist.includes(notificationType)) {
    logger.info(
      `Notification type ${notificationType} is in the blocklist - tenantIds: ${tenantIds.join(",")}`
    );
    return [];
  }
  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenantIds,
      notificationType
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

export function retrieveLatestDescriptor(eservice: EService): Descriptor {
  if (eservice.descriptors.length === 0) {
    throw eserviceWithoutDescriptors(eservice.id);
  }

  const publishedDescriptor = eservice.descriptors.find(
    (d) => d.state === descriptorState.published
  );

  if (publishedDescriptor) {
    return publishedDescriptor;
  }

  const latestNotDraftDescriptor = eservice.descriptors
    .filter((d) => d.state !== descriptorState.draft)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
  if (latestNotDraftDescriptor) {
    return latestNotDraftDescriptor;
  }

  return eservice.descriptors[0];
}

export async function retrieveEservice(
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<EService> {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (!eservice) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
}

export async function retrievePurpose(
  purposeId: PurposeId,
  readModelService: ReadModelServiceSQL
): Promise<Purpose> {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (!purpose) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
}

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelServiceSQL
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

export async function retrieveTenantByCertifierId(
  certifierId: string,
  readModelService: ReadModelServiceSQL
): Promise<Tenant> {
  const tenant = await readModelService.getTenantByCertifierId(certifierId);
  if (!tenant) {
    throw certifierTenantNotFound(certifierId);
  }
  return tenant;
}
