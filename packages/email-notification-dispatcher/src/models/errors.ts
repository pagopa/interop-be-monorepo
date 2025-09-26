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
  | "eServiceNotFound"
  | "tenantNotFound"
  | "descriptorNotFound"
  | "eserviceAgreementsNotFound"
  | "descriptorPublishedNotFound";

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

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}

export function descriptorPublishedNotFound(
  eServiceId: EServiceId
): EmailNotificationDispatcherError {
  return new InternalError({
    detail: `Published descriptor not found in EService ${eServiceId}`,
    code: "descriptorPublishedNotFound",
  });
}
