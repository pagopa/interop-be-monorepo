import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  contactCreationFailed: "0001",
};

type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function contactCreationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "contactCreationFailed",
    title: "Contact creation failed",
    detail: "Unable to create contact",
  });
}
