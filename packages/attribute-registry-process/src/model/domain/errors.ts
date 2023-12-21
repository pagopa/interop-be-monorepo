import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  attributeNotFound: "0001",
  attributeDuplicate: "0002",
  originNotCompliant: "0003",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function attributeNotFound(identifier: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: "attributeNotFound",
    title: "Attribute not found",
  });
}

export function attributeDuplicate(
  attributeName: string
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `ApiError during Attribute creation with name ${attributeName}`,
    code: "attributeDuplicate",
    title: "Duplicated attribute name",
  });
}

export function originNotCompliant(origin: string): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Requester has not origin ${origin}`,
    code: "originNotCompliant",
    title: "Origin is not compliant",
  });
}
