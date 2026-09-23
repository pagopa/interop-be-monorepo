import {
  Problem,
  makeApiProblemBuilder,
  ProblemBuilderOptions,
} from "pagopa-interop-models";

import {
  UserFacingProblem,
  ErrorCopy,
  MakeUserFacingApiProblemFn,
} from "../models/index.js";

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

export function makeUserFacingApiProblemBuilder<T extends string>(
  errors: Record<T, string>,
  options: ProblemBuilderOptions = {},
  errorCopy: ErrorCopy
): MakeUserFacingApiProblemFn<T> {
  const makeApiProblem = makeApiProblemBuilder(errors, options);

  const userFacingApiProblem: MakeUserFacingApiProblemFn<T> = (
    error,
    httpMapper,
    context,
    operationalLogMessage,
    placeholderMapper
  ) => {
    const problem = makeApiProblem(
      error,
      httpMapper,
      context,
      operationalLogMessage
    );

    const userFacingProblem = applyErrorCopy(
      problem,
      context.endpoint,
      errorCopy
    );

    if (!placeholderMapper) {
      return userFacingProblem;
    }

    return placeholderMapper(userFacingProblem);
  };
  return userFacingApiProblem;
}
