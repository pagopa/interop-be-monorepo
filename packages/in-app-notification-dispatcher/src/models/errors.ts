import { EServiceId, InternalError } from "pagopa-interop-models";

type InAppNotificationDispatcherErrorCode =
  | "tenantNotFound"
  | "descriptorPublishedNotFound"
  | "eserviceNotFound"
  | "activeProducerDelegationNotFound"
  | "descriptorNotFound"
  | "purposeNotFound";

export class InAppNotificationDispatcherError extends InternalError<InAppNotificationDispatcherErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: InAppNotificationDispatcherErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function tenantNotFound(
  tenantId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function descriptorPublishedNotFound(
  eServiceId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Published descriptor not found in EService ${eServiceId}`,
    code: "descriptorPublishedNotFound",
  });
}

export function eserviceNotFound(
  eServiceId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `EService ${eServiceId} not found`,
    code: "eserviceNotFound",
  });
}

export function activeProducerDelegationNotFound(
  eServiceId: EServiceId
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Active producer delegation not found for EService ${eServiceId}`,
    code: "activeProducerDelegationNotFound",
  });
}

export function descriptorNotFound(
  descriptorId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found`,
    code: "descriptorNotFound",
  });
}

export function purposeNotFound(
  purposeId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
  });
}
