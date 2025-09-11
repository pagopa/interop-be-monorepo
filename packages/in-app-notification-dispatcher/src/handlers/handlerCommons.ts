import {
  EService,
  Descriptor,
  descriptorState,
  Tenant,
  TenantId,
  EServiceId,
  PurposeId,
  Purpose,
  NotificationType,
  UserId,
  userRole,
} from "pagopa-interop-models";
import { notificationAdmittedRoles } from "pagopa-interop-commons";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";
import {
  descriptorPublishedNotFound,
  eserviceNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../models/errors.js";

export async function getNotificationRecipients(
  tenantIds: TenantId[],
  notificationType: NotificationType,
  readModelService: ReadModelServiceSQL,
  userServiceSQL: UserServiceSQL
): Promise<Array<{ userId: UserId; tenantId: TenantId }>> {
  const usersWithNotifications =
    await readModelService.getTenantUsersWithNotificationEnabled(
      tenantIds,
      notificationType
    );
  const userRoles = await userServiceSQL.readUsers(
    usersWithNotifications.map(({ userId }) => userId)
  );
  return usersWithNotifications.filter(({ userId }) =>
    userRoles.some(
      ({ userId: id, role }) =>
        id === userId &&
        role !== userRole.SUPPORT_ROLE &&
        notificationAdmittedRoles[notificationType][role]
    )
  );
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
