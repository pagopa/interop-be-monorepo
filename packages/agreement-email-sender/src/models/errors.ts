import { DescriptorId, EServiceId, InternalError } from "pagopa-interop-models";

type AgreementEmailSenderErrorCode =
  | "htmlTemplateNotFound"
  | "agreementStampDateNotFound"
  | "eServiceNotFound"
  | "tenantNotFound"
  | "tenantDigitalAddressNotFound"
  | "descriptorNotFound";

export class AgreementEmailSenderError extends InternalError<AgreementEmailSenderErrorCode> {
  constructor({
    code,
    detail,
  }: {
    code: AgreementEmailSenderErrorCode;
    detail: string;
  }) {
    super({ code, detail });
  }
}

export function htmlTemplateNotFound(path: string): AgreementEmailSenderError {
  return new InternalError({
    detail: `HTML template not found at ${path}`,
    code: "htmlTemplateNotFound",
  });
}

export function agreementStampDateNotFound(
  stamp: string,
  agreementId: string
): AgreementEmailSenderError {
  return new InternalError({
    detail: `${stamp} date not found for agreement ${agreementId}`,
    code: "agreementStampDateNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): AgreementEmailSenderError {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function tenantNotFound(tenantId: string): AgreementEmailSenderError {
  return new InternalError({
    detail: `Tenant ${tenantId} not found`,
    code: "tenantNotFound",
  });
}

export function tenantDigitalAddressNotFound(
  tenantId: string
): AgreementEmailSenderError {
  return new InternalError({
    detail: `Digital address not found for tenant ${tenantId}`,
    code: "tenantDigitalAddressNotFound",
  });
}

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): AgreementEmailSenderError {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}
