import type { ErrorMessage } from "pagopa-interop-models";

import { constants } from "http2";
import {
  Problem,
  emptyErrorMapper,
  genericError,
  makeApiProblemBuilder,
  ProblemBuilderOptions,
} from "pagopa-interop-models";

import {
  MakeUserFacingApiProblemFn,
  UserFacingProblem,
  UserFacingProblemWithMessage,
  PlaceholderMapperGeneratorReturn,
} from "./types.js";

const { HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

// bffEndpoint -> errorCode -> first ErrorMessage with a non-empty Italian copy
export type ErrorCopyIndex = Map<string, Map<string, ErrorMessage>>;

export function indexErrorMessages(
  errorMessages: readonly ErrorMessage[]
): ErrorCopyIndex {
  const index: ErrorCopyIndex = new Map();
  for (const message of errorMessages) {
    if (message.copy.it.trim() === "") {
      continue;
    }
    let messagesByCode = index.get(message.bffEndpoint);
    if (!messagesByCode) {
      messagesByCode = new Map();
      index.set(message.bffEndpoint, messagesByCode);
    }
    if (!messagesByCode.has(message.errorCode)) {
      messagesByCode.set(message.errorCode, message);
    }
  }
  return index;
}

export function applyErrorCopy(
  problem: Problem,
  endpoint: string | undefined,
  errorCopyIndex: ErrorCopyIndex,
  defaultLanguage?: keyof ErrorMessage["copy"]
): UserFacingProblem {
  if (!endpoint) {
    return problem;
  }

  const messagesByCode = errorCopyIndex.get(endpoint);
  const copy = messagesByCode
    ? problem.errors
        ?.map(({ code }) => messagesByCode.get(code))
        .find((entry) => entry !== undefined)
    : undefined;

  if (!copy) {
    return problem;
  }

  const userMessages = {
    it: copy.copy.it.trim(),
    en: copy.copy.en.trim() || undefined,
  };
  const userMessage = userMessages[defaultLanguage ?? "it"] || userMessages.it;

  return {
    ...problem,
    userMessage,
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
    return (problem: UserFacingProblemWithMessage) => ({
      ...problem,
      detail: problem.detail ? replace(value, problem.detail) : undefined,
      userMessage: replace(value, problem.userMessage),
    });
  } catch (error) {
    onError(error);
    return undefined;
  }
}

function errorHasUserMessages(
  error: UserFacingProblem
): error is UserFacingProblemWithMessage {
  return error.userMessage !== undefined;
}

export async function applyPlaceholderToError(
  error: UserFacingProblem,
  placeholders: string[],
  placeholderGenerator: () => PlaceholderMapperGeneratorReturn
): Promise<UserFacingProblem> {
  if (
    errorHasUserMessages(error) &&
    placeholders &&
    placeholders.some((placeholder) => error.userMessage.includes(placeholder))
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
  const errorCopyIndex = indexErrorMessages(errorMessages);

  const userFacingApiProblem: MakeUserFacingApiProblemFn<T> = (
    error,
    httpMapper,
    context,
    operationalLogMessage
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
      errorCopyIndex,
      context.locale
    );

    // 500 errors are shown with their CSV copy only when one exists;
    // otherwise the internal details (possibly coming from downstream processes) are hidden
    if (
      problem.status === HTTP_STATUS_INTERNAL_SERVER_ERROR &&
      !errorHasUserMessages(userFacingProblem)
    ) {
      return makeApiProblem(
        genericError("Unexpected error"),
        emptyErrorMapper,
        context
      );
    }

    return userFacingProblem;
  };
  return userFacingApiProblem;
}
