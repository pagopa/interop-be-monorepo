import { ErrorCopy, ErrorMessage } from "pagopa-interop-error-message-parser";
import {
  Problem,
  makeApiProblemBuilder,
  ProblemBuilderOptions,
} from "pagopa-interop-models";

import { MakeUserFacingApiProblemFn, UserFacingProblem } from "./types.js";

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

export async function placeholderMapperGenerator<T>(
  callback: () => Promise<T>,
  replace: (value: T, message: string) => string
): Promise<
  | ((
      prob: UserFacingProblem & { userMessages: ErrorMessage }
    ) => UserFacingProblem)
  | undefined
> {
  try {
    const value = await callback();
    return (problem: UserFacingProblem & { userMessages: ErrorMessage }) => ({
      ...problem,
      detail: problem.detail ? replace(value, problem.detail) : undefined,
      userMessages: {
        it: replace(value, problem.userMessages.it),
        en: problem.userMessages.en
          ? replace(value, problem.userMessages.en)
          : undefined,
      },
    });
  } catch {
    return undefined;
  }
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

    if (placeholderMapper) {
      const { userMessages } = userFacingProblem;

      if (userMessages) {
        return placeholderMapper({
          ...userFacingProblem,
          userMessages,
        });
      }
    }

    return userFacingProblem;
  };
  return userFacingApiProblem;
}
