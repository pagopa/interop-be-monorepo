import { userRoles } from "pagopa-interop-commons";
import { TenantId, UserId } from "pagopa-interop-models";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { userWithoutSecurityPrivileges } from "../model/domain/errors.js";

export const isClientConsumer = (
  consumerId: TenantId,
  organizationId: string
): boolean => (consumerId === organizationId ? true : false);

export const assertUserSelfcareSecurityPrivileges = async (
  selfcareId: string,
  requesterUserId: UserId,
  consumerId: TenantId
): Promise<void> => {
  const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
    params: { institutionId: selfcareId },
    queries: {
      userIdForAuth: requesterUserId,
      userId: consumerId,
      productRoles: [userRoles.SECURITY_ROLE, userRoles.ADMIN_ROLE],
    },
  });
  if (users.length === 0) {
    throw userWithoutSecurityPrivileges(consumerId, requesterUserId);
  }
};
