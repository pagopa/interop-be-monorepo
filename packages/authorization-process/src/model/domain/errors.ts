import {
  ApiError,
  ClientId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  clientNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function clientNotFound(clientId: ClientId): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Client ${clientId} not found`,
    code: "clientNotFound",
    title: "Client not found",
  });
}
