import { EServiceId, InternalError } from "pagopa-interop-models";

type InAppNotificationDispatcherErrorCode =
  | "tenantNotFound"
  | "eserviceNotFound"
  | "activeProducerDelegationNotFound"
  | "purposeNotFound"
  | "descriptorNotFound"
  | "purposeNotFound"
  | "clientKeyNotFound"
  | "producerKeychainKeyNotFound"
  | "attributeNotFound"
  | "certifierTenantNotFound"
  | "attributeOriginUndefined"
  | "attributeNotFoundInTenant";

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

export function clientKeyNotFound(
  clientId: string,
  kid: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Client key ${kid} not found in client ${clientId}`,
    code: "clientKeyNotFound",
  });
}

export function producerKeychainKeyNotFound(
  producerKeychainId: string,
  kid: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Producer keychain key ${kid} not found in producer keychain ${producerKeychainId}`,
    code: "producerKeychainKeyNotFound",
  });
}

export function attributeNotFound(
  attributeId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
  });
}

export function certifierTenantNotFound(
  certifierId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Certifier tenant ${certifierId} not found`,
    code: "certifierTenantNotFound",
  });
}

export function attributeOriginUndefined(
  attributeId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Attribute ${attributeId} has undefined origin`,
    code: "attributeOriginUndefined",
  });
}

export function verifiedAttributeNotFoundInTenant(
  tenantId: string,
  attributeId: string
): InAppNotificationDispatcherError {
  return new InternalError({
    detail: `Verified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "attributeNotFoundInTenant",
  });
}
