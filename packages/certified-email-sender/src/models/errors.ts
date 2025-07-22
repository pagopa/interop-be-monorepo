import { DescriptorId, EServiceId, InternalError } from "pagopa-interop-models";

type CertifiedEmailSenderErrorCode =
  | "htmlTemplateNotFound"
  | "agreementStampDateNotFound"
  | "eServiceNotFound"
  | "tenantNotFound"
  | "tenantDigitalAddressNotFound"
  | "descriptorNotFound";

export class CertifiedEmailSenderError extends InternalError<CertifiedEmailSenderErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: CertifiedEmailSenderErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function htmlTemplateNotFound(path: string): CertifiedEmailSenderError {
  return new InternalError({
    detail: `HTML template not found at ${path}`,
    code: "htmlTemplateNotFound",
  });
}

export function agreementStampDateNotFound(
  stamp: string,
  agreementId: string
): CertifiedEmailSenderError {
  return new InternalError({
    detail: `${stamp} date not found for agreement ${agreementId}`,
    code: "agreementStampDateNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): CertifiedEmailSenderError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function tenantNotFound(tenantId: string): CertifiedEmailSenderError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function tenantDigitalAddressNotFound(
  tenantId: string
): CertifiedEmailSenderError {
  return new InternalError({
    detail: `Digital address not found for tenant ${tenantId}`,
    code: "tenantDigitalAddressNotFound",
  });
}

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): CertifiedEmailSenderError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}
