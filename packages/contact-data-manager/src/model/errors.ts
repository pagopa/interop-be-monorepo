import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  contactCreationFailed: "0001",
  contactNotFound: "0002",
  contactRetrievalFailed: "0003",
};

export type ErrorCodes = keyof typeof errorCodes;

const buildApiProblem = makeApiProblemBuilder(errorCodes);

// Preserve API error mapping without logging arbitrary exception details.
export const makeApiProblem: typeof buildApiProblem = (
  error,
  httpMapper,
  context
) =>
  buildApiProblem(error, httpMapper, {
    ...context,
    logger: {
      error: () => context.logger.error("Contact request failed"),
      warn: () => context.logger.warn("Contact request failed"),
    },
  });

export function contactCreationFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "contactCreationFailed",
    title: "Contact creation failed",
    detail: "Unable to create contact",
  });
}

export function contactNotFound(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "contactNotFound",
    title: "Contact not found",
    detail: "Contact not found",
  });
}

export function contactRetrievalFailed(): ApiError<ErrorCodes> {
  return new ApiError({
    code: "contactRetrievalFailed",
    title: "Contact retrieval failed",
    detail: "Unable to retrieve contact",
  });
}
