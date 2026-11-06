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
  UserFacingProblemWithMessages,
  PlaceholderMapperGeneratorReturn,
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
  const detail = userMessages[defaultLanguage ?? "it"] || userMessages.it;

  return {
    ...problem,
    detail,
    userMessages,
  };
}

export async function placeholderMapperGenerator<T>(
  callback: (() => Promise<T>) | (() => T),
  replace: (value: T, message: string) => string,
  onError: (error: unknown) => void
): PlaceholderMapperGeneratorReturn {
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
  } catch (error) {
    onError(error);
    return undefined;
  }
}

function errorHasUserMessages(
  error: UserFacingProblem
): error is UserFacingProblemWithMessages {
  return error.userMessages !== undefined;
}

export async function applyPlaceholderToError(
  error: UserFacingProblem,
  placeholders: string[],
  placeholderGenerator: () => PlaceholderMapperGeneratorReturn
): Promise<UserFacingProblem> {
  if (
    errorHasUserMessages(error) &&
    placeholders &&
    placeholders.some((placeholder) =>
      error.userMessages.it.includes(placeholder)
    )
  ) {
    const placeholderMapper = await placeholderGenerator();
    if (placeholderMapper) {
      return placeholderMapper(error);
    }
  }
  return error;
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

    if (placeholderMapper && errorHasUserMessages(userFacingProblem)) {
      return placeholderMapper(userFacingProblem);
    }

    return userFacingProblem;
  };
  return userFacingApiProblem;
}
