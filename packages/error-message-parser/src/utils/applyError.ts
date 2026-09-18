import { Problem } from "pagopa-interop-models";

import { UserFacingProblem, ErrorCopy } from "../models/index.js";

export function applyErrorCopy(
  problem: Problem,
  endpoint: string | undefined,
  errorCopy: ErrorCopy
): UserFacingProblem {
  const endpointCopy = endpoint ? errorCopy[endpoint] : undefined;
  if (!endpointCopy) {
    return problem;
  }

  // When more errors have a copy, the first one drives the user facing message
  const copy = problem.errors
    ?.map(({ code }) => endpointCopy[code])
    .find((entry) => entry !== undefined);

  if (!copy) {
    return problem;
  }

  return {
    ...problem,
    detail: copy.messages.it,
    userMessages: copy.messages,
  };
}
