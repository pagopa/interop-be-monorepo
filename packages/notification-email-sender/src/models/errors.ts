import { DescriptorId, EServiceId, InternalError } from "pagopa-interop-models";

type NotificationEmailSenderErrorCode =
  | "htmlTemplateNotFound"
  | "agreementStampDateNotFound"
  | "eServiceNotFound"
  | "tenantNotFound"
  | "tenantDigitalAddressNotFound"
  | "descriptorNotFound"
  | "eserviceAgreementsNotFound"
  | "descriptorPublishedNotFound";

export class NotificationEmailSenderError extends InternalError<NotificationEmailSenderErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: NotificationEmailSenderErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function htmlTemplateNotFound(
  path: string
): NotificationEmailSenderError {
  return new InternalError({
    detail: `HTML template not found at ${path}`,
    code: "htmlTemplateNotFound",
  });
}

export function agreementStampDateNotFound(
  stamp: string,
  agreementId: string
): NotificationEmailSenderError {
  return new InternalError({
    detail: `${stamp} date not found for agreement ${agreementId}`,
    code: "agreementStampDateNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): NotificationEmailSenderError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function tenantNotFound(tenantId: string): NotificationEmailSenderError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): NotificationEmailSenderError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}

export function descriptorPublishedNotFound(
  eServiceId: EServiceId
): NotificationEmailSenderError {
  return new InternalError({
    detail: `Published descriptor not found in EService ${eServiceId}`,
    code: "descriptorPublishedNotFound",
  });
}
