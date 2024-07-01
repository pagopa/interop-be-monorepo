import {
  ApiError,
  PurposeId,
  TenantId,
  EServiceId,
  makeApiProblemBuilder,
  DescriptorId,
  AttributeId,
} from "pagopa-interop-models";

export const errorCodes = {
  purposeNotFound: "0001",
  descriptorNotFound: "0006",
  attributeNotExists: "0008",
  invalidEserviceRequester: "0009",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function purposeNotFound(purposeId: PurposeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Purpose ${purposeId} not found`,
    code: "purposeNotFound",
    title: "Purpose not found",
  });
}

export function invalidEServiceRequester(
  eServiceId: EServiceId,
  requesterId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `EService ${eServiceId} does not belong to producer ${requesterId}`,
    code: "invalidEserviceRequester",
    title: `Invalid eservice requester`,
  });
}

export function eserviceDescriptorNotFound(
  eServiceId: EServiceId,
  descriptorId: DescriptorId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Descriptor ${descriptorId} not found in Eservice ${eServiceId}`,
    code: "descriptorNotFound",
    title: `Descriptor not found`,
  });
}

export function attributeNotExists(id: AttributeId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${id} does not exist in the attribute registry`,
    code: "attributeNotExists",
    title: "Attribute not exists",
  });
}
