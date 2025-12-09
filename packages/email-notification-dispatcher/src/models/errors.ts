import {
  DescriptorId,
  EServiceId,
  TenantId,
  InternalError,
  AgreementId,
} from "pagopa-interop-models";

type EmailNotificationDispatcherErrorCode =
  | "htmlTemplateNotFound"
  | "agreementStampDateNotFound"
  | "attributeNotFound"
  | "eServiceNotFound"
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
  | "certifierTenantNotFound";

export class EmailNotificationDispatcherError extends InternalError<EmailNotificationDispatcherErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: EmailNotificationDispatcherErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function htmlTemplateNotFound(
  path: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `HTML template not found at ${path}`,
    code: "htmlTemplateNotFound",
  });
}

export function agreementStampDateNotFound(
  stamp: string,
  agreementId: AgreementId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `${stamp} date not found for agreement ${agreementId}`,
    code: "agreementStampDateNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function eserviceAgreementsNotFound(
  eserviceId: EServiceId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Agreements not found for eservice ${eserviceId}`,
    code: "eserviceAgreementsNotFound",
  });
}

export function tenantNotFound(
  tenantId: TenantId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function certifierTenantNotFound(
  certifierId: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Certifier tenant ${certifierId} not found`,
    code: "certifierTenantNotFound",
  });
}

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}

export function eserviceWithoutDescriptors(
  eServiceId: EServiceId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `EService ${eServiceId} does not have any descriptor`,
    code: "eserviceWithoutDescriptors",
  });
}

export function activeProducerDelegationNotFound(
  eServiceId: EServiceId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Active producer delegation not found for EService ${eServiceId}`,
    code: "activeProducerDelegationNotFound",
  });
}

export function attributeNotFound(
  attributeId: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Attribute ${attributeId} not found`,
    code: "attributeNotFound",
  });
}

export function clientKeyNotFound(
  clientId: string,
  kid: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Client key ${kid} not found in client ${clientId}`,
    code: "clientKeyNotFound",
  });
}

export function producerKeychainKeyNotFound(
  producerKeychainId: string,
  kid: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Producer keychain key ${kid} not found in producer keychain ${producerKeychainId}`,
    code: "producerKeychainKeyNotFound",
  });
}

export function purposeNotFound(
  purposeId: string
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
  });
}
