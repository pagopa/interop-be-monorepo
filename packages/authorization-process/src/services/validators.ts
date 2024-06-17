import { userRoles } from "pagopa-interop-commons";
import { Purpose, TenantId, UserId } from "pagopa-interop-models";
import { selfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  securityUserNotFound,
  organizationNotAllowedOnPurpose,
} from "../model/domain/errors.js";

export const isClientConsumer = (
  consumerId: TenantId,
  organizationId: string
): boolean => (consumerId === organizationId ? true : false);

export const assertOrganizationIsPurposeConsumer = (
  organizationId: TenantId,
  purpose: Purpose
): void => {
  if (organizationId !== purpose.consumerId) {
    throw organizationNotAllowedOnPurpose(organizationId, purpose.id);
  }
};

export const assertSelfcareUser = async (
  selfcareId: string,
  requesterUserId: UserId,
  userId: UserId
): Promise<void> => {
  const users = await selfcareV2Client.getInstitutionProductUsersUsingGET({
    params: { institutionId: selfcareId },
    queries: {
      userIdForAuth: requesterUserId,
      userId,
      productRoles: [userRoles.SECURITY_ROLE, userRoles.ADMIN_ROLE],
    },
  });
  if (users.length === 0) {
    throw securityUserNotFound(requesterUserId, userId);
  }
};
