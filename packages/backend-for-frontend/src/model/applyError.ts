import type { ErrorMessage } from "pagopa-interop-models";

import {
  Problem,
  makeApiProblemBuilder,
  ProblemBuilderOptions,
} from "pagopa-interop-models";

import {
  MakeUserFacingApiProblemFn,
  UserFacingMessages,
  UserFacingProblem,
} from "./types.js";

export function applyErrorCopy(
  problem: Problem,
  endpoint: string | undefined,
  errorMessages: readonly ErrorMessage[],
  defaultLanguage?: keyof ErrorMessage["copy"]
): UserFacingProblem {
  if (!endpoint) {
    return problem;
  }

  const copy = problem.errors
    ?.map(({ code }) =>
      errorMessages.find(
        (message) =>
          message.bffEndpoint === endpoint &&
          message.errorCode === code &&
          message.copy.it.trim() !== ""
      )
    )
    .find((entry) => entry !== undefined);

  if (!copy) {
    return problem;
  }

  const userMessages = {
    it: copy.copy.it.trim(),
    en: copy.copy.en.trim() || undefined,
  };
  const detail =
    userMessages[defaultLanguage ?? "it"] || userMessages.it;

  return {
    ...problem,
    detail,
    userMessages,
  };
}

export async function placeholderMapperGenerator<T>(
  callback: (() => Promise<T>) | (() => T),
  replace: (value: T, message: string) => string
): Promise<
  | ((
      prob: UserFacingProblem & { userMessages: UserFacingMessages }
    ) => UserFacingProblem)
  | undefined
> {
  try {
    const callbackValue = callback();
    const value =
      callbackValue instanceof Promise ? await callbackValue : callbackValue;
    return (
      problem: UserFacingProblem & {
        userMessages: UserFacingMessages;
      }
    ) => ({
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
  errorMessages: readonly ErrorMessage[]
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
      errorMessages,
      context.locale
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
