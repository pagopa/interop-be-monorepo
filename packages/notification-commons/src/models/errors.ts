import {
  DescriptorId,
  EServiceId,
  InternalError,
  TenantId,
} from "pagopa-interop-models";

type NotificationCommonsErrorCode =
  | "htmlTemplateNotFound"
  | "agreementStampDateNotFound"
  | "attributeNotFound"
  | "eServiceNotFound"
  | "eserviceNotFound"
  | "tenantNotFound"
  | "descriptorNotFound"
  | "activeProducerDelegationNotFound"
  | "eserviceAgreementsNotFound"
  | "eserviceWithoutDescriptors"
  | "descriptorPublishedNotFound"
  | "certifierTenantNotFound"
  | "clientKeyNotFound"
  | "producerKeychainKeyNotFound"
  | "purposeNotFound"
  | "attributeOriginUndefined"
  | "attributeNotFoundInTenant";

export class NotificationCommonsError extends InternalError<NotificationCommonsErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: NotificationCommonsErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function htmlTemplateNotFound(path: string): NotificationCommonsError {
  return new InternalError({
    detail: `HTML template not found at ${path}`,
    code: "htmlTemplateNotFound",
  });
}

export function tenantNotFound(tenantId: TenantId): NotificationCommonsError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): NotificationCommonsError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function eserviceNotFound(
  eserviceId: EServiceId
): NotificationCommonsError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eserviceNotFound",
  });
}

export function descriptorNotFound(
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): NotificationCommonsError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eserviceId}`,
    code: "descriptorNotFound",
  });
}

export function eserviceWithoutDescriptors(
  eserviceId: EServiceId
): NotificationCommonsError {
  return new InternalError({
    detail: `EService ${eserviceId} does not have any descriptor`,
    code: "eserviceWithoutDescriptors",
  });
}

export function activeProducerDelegationNotFound(
  eserviceId: EServiceId
): NotificationCommonsError {
  return new InternalError({
    detail: `Active producer delegation not found for EService ${eserviceId}`,
    code: "activeProducerDelegationNotFound",
  });
}

export function attributeNotFound(
  attributeId: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
  });
}

export function clientKeyNotFound(
  clientId: string,
  kid: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Client key ${kid} not found in client ${clientId}`,
    code: "clientKeyNotFound",
  });
}

export function producerKeychainKeyNotFound(
  producerKeychainId: string,
  kid: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Producer keychain key ${kid} not found in producer keychain ${producerKeychainId}`,
    code: "producerKeychainKeyNotFound",
  });
}

export function purposeNotFound(purposeId: string): NotificationCommonsError {
  return new InternalError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
  });
}

export function certifierTenantNotFound(
  certifierId: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Certifier tenant ${certifierId} not found`,
    code: "certifierTenantNotFound",
  });
}

export function attributeOriginUndefined(
  attributeId: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Attribute ${attributeId} has undefined origin`,
    code: "attributeOriginUndefined",
  });
}

export function verifiedAttributeNotFoundInTenant(
  tenantId: string,
  attributeId: string
): NotificationCommonsError {
  return new InternalError({
    detail: `Verified attribute ${attributeId} not found in tenant ${tenantId}`,
    code: "attributeNotFoundInTenant",
  });
}
