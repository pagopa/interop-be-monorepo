import { Client, TenantId } from "pagopa-interop-models";
import { organizationNotAllowedOnClient } from "../model/domain/errors.js";

export const isClientConsumer = (
  consumerId: TenantId,
  organizationId: string
): boolean => consumerId === organizationId;

export const assertOrganizationIsClientConsumer = (
  organizationId: TenantId,
  client: Client
): void => {
  if (client.consumerId !== organizationId) {
    throw organizationNotAllowedOnClient(organizationId, client.id);
  }
};
