import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  purposeTemplateNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes, {
  problemErrorsPassthrough: true,
  forceGenericProblemOn500: true,
});
