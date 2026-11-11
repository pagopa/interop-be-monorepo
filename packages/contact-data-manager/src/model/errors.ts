import { ApiError, makeApiProblemBuilder } from "pagopa-interop-models";

const errorCodes = {
  contactCreationFailed: "0001",
};

type ErrorCodes = keyof typeof errorCodes;

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
