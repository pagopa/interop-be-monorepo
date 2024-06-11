import { DescriptorId, EServiceId, InternalError } from "pagopa-interop-models";

export const errorCodes = {
  selfcareIdNotFound: "0019",
  eServiceNotFound: "0005",
  institutionNotFound: "0024",
  descriptorNotFound: "0014",
};

export type ErrorCodes = keyof typeof errorCodes;

export function selfcareIdNotFound(
  tenantId: string
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Selfcare id not found for tenant ${tenantId}`,
    code: "selfcareIdNotFound",
  });
}

export function eServiceNotFound(
  eserviceId: EServiceId
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `EService ${eserviceId} not found`,
    code: "eServiceNotFound",
  });
}

export function institutionNotFound(
  institutionId: string
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Institution ${institutionId} not found`,
    code: "institutionNotFound",
  });
}

export function descriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): InternalError<ErrorCodes> {
  return new InternalError({
    detail: `Descriptor ${descriptorId} not found in EService ${eServiceId}`,
    code: "descriptorNotFound",
  });
}
