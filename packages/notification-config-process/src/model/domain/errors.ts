import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  notificationTenantNotFound: "0001",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);
