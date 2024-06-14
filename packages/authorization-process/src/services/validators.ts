import { Purpose, TenantId } from "pagopa-interop-models";
import { organizationNotAllowedOnPurpose } from "../model/domain/errors.js";

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
