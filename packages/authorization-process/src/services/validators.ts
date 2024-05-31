import { TenantId } from "pagopa-interop-models";

export const isClientConsumer = (
  consumerId: TenantId,
  organizationId: string
): boolean => consumerId === organizationId;
