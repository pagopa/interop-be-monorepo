import { ApiError } from "pagopa-interop-models";

const errorCodes = {
  attributeNotFound: "0001",
};

export function attributeNotFound(identifier: string): ApiError {
  return new ApiError({
    detail: `Attribute ${identifier} not found`,
    code: errorCodes.attributeNotFound,
    httpStatus: 404,
    title: "Attribute not found",
  });
}
