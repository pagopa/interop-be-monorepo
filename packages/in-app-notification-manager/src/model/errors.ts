import { makeApiProblemBuilder } from "pagopa-interop-models";

export const errorCodes = {
  notificationNotFound: "0001",
} as const;

type ErrorCodeKeys = keyof typeof errorCodes;
type ErrorCodeValues = (typeof errorCodes)[ErrorCodeKeys];

export type ErrorCodes = Record<ErrorCodeKeys, ErrorCodeValues>;

export const makeApiProblem = makeApiProblemBuilder(errorCodes as ErrorCodes);
