import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  attributeNotFound: "0001",
  attributeDuplicate: "0002",
  originNotCompliant: "0003",
};

export function attributeNotFound(identifier: string): ApiError {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: errorCodes.attributeNotFound,
    httpStatus: 404,
    title: "Attribute not found",
  });
}

export function attributeDuplicate(attributeName: string): ApiError {
  return new ApiError({
    detail: `ApiError during Attribute creation with name ${attributeName}`,
    code: errorCodes.attributeDuplicate,
    httpStatus: 409,
    title: "Duplicated attribute name",
  });
}

export function originNotCompliant(origin: string): ApiError {
  return new ApiError({
    detail: `Requester has not origin ${origin}`,
    code: errorCodes.originNotCompliant,
    httpStatus: 409,
    title: "Origin is not compliant",
  });
}
