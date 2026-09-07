import { Problem } from "pagopa-interop-models";

export const supportedLanguages = ["it", "en", "fr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** Language used for the plain `detail` field, which is not localizable. */
export const defaultLanguage: SupportedLanguage = "it";

export type LocalizedMessage = Record<SupportedLanguage, string>;

export type ErrorCopyEntry = {
  /** Code exposed to the frontend as `Problem.type`, e.g. "eserviceNotFound" */
  key: string;
  messages: LocalizedMessage;
};

/**
 * Copy of the errors an endpoint can return, keyed by the error code exposed
 * in `Problem.errors[].code` (`<serviceCode>-<errorCode>`, e.g. "001-0007").
 */
export type EndpointErrorCopy = Record<string, ErrorCopyEntry>;

/**
 * User facing copy, scoped by endpoint: the same error code can have a
 * different message depending on the endpoint that returned it.
 * The endpoint key is `<METHOD> <route path>`, e.g. "GET /catalog/:eserviceId".
 * Endpoints and codes not listed here keep the message coming from the process.
 */
export const errorCopy: Record<string, EndpointErrorCopy> = {
  "GET /catalog/:eserviceId": {
    "001-0007": {
      key: "eserviceNotFound",
      messages: {
        it: "Il servizio richiesto non è stato trovato.",
        en: "The requested service was not found.",
        fr: "Le service demandé est introuvable.",
      },
    },
  },
  "POST /catalog/:eserviceId/agreements": {
    "001-0001": {
      key: "agreementAlreadySubmitted",
      messages: {
        it: "L'accordo per questo servizio è già stato inviato.",
        en: "The agreement for this service has already been submitted.",
        fr: "L'accord pour ce service a déjà été soumis.",
      },
    },
  },
};

/** Problem enriched with the user facing copy in every available language. */
export type UserFacingProblem = Problem & {
  userMessages?: LocalizedMessage;
};

export function applyErrorCopy(
  problem: Problem,
  endpoint: string | undefined
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
    type: copy.key,
    detail: copy.messages[defaultLanguage],
    userMessages: copy.messages,
    errors: problem.errors?.map((error) => ({
      ...error,
      detail:
        endpointCopy[error.code]?.messages[defaultLanguage] ?? error.detail,
    })),
  };
}
