import * as XLSX from "xlsx";
import { z } from "zod";
import { catalogErrorCodes } from "pagopa-interop-commons";
import { Problem } from "pagopa-interop-models";

const MethodUrl = z.string().regex(/^(GET|POST|PUT|DELETE) \/[\w\/-:]+$/);

type MethodUrl = z.infer<typeof MethodUrl>;

const MessageObject = z.object({
  key: z.string(),
  messages: z.object({
    it: z.string(),
    en: z.string().optional(),
    fr: z.string().optional(),
  }),
});

type MessageObject = z.infer<typeof MessageObject>;

type EndpointErrorCopy = Record<string, MessageObject>;

type ErrorCopy = Record<MethodUrl, EndpointErrorCopy>;

const schema = z.object({
  language: z.string(),
  errors: z.array(
    z.object({
      scope: z.string(),
      errorCode: z.string(),
      message: z.string(),
      url: MethodUrl,
    }),
  ),
});

type Schema = z.infer<typeof schema>;

function getScopeCode(scope: string): string | undefined {
  if (scope === "catalogProcess") {
    return "004";
  }
  if (scope === "anotherScope") {
    return "005";
  }
  return undefined;
}

function getErrorCode(scope: string, errorCode: string): string | undefined {
  if (scope === "catalogProcess") {
    if (errorCode in catalogErrorCodes) {
      return catalogErrorCodes[errorCode as keyof typeof catalogErrorCodes];
    }
  }
  return undefined;
}

function getRawErrors(): Schema[] {
  // FIXME: We could get this from S3
  const workbook = XLSX.readFile("input.xlsx");

  const out: Schema[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (!["it", "en"].includes(sheetName)) {
      continue;
    }
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    });

    const errors: Schema["errors"] = [];
    for (const row of rows.slice(1)) {
      const [scope, errorCode, message, url] = row as string[];
      if (!MethodUrl.safeParse(url).success) {
        console.log(`Invalid URL format: ${url}`);
        continue;
      }
      errors.push({
        scope,
        errorCode,
        message,
        url,
      });
    }
    out.push({
      language: sheetName,
      errors,
    });
  }
  return out;
}

function getErrors(): ErrorCopy {
  const rawErrors = getRawErrors();
  const errorCopy: ErrorCopy = {};

  for (const { language, errors } of rawErrors) {
    for (const { scope, errorCode, message, url } of errors) {
      const methodUrl = url as MethodUrl;
      const scopeNumber = getScopeCode(scope);
      if (!scopeNumber) {
        continue;
      }
      const numberError = getErrorCode(scope, errorCode);
      if (!numberError) {
        continue;
      }
      const key = `${scopeNumber}-${numberError}`;
      if (!errorCopy[methodUrl]) {
        errorCopy[methodUrl] = {};
      }
      if (!errorCopy[methodUrl][key]) {
        errorCopy[methodUrl][key] = {
          key: errorCode,
          messages: {
            it: "",
            en: undefined,
            fr: undefined,
          },
        };
      }
      errorCopy[methodUrl][key].messages[
        language as keyof MessageObject["messages"]
      ] = message;
    }
  }

  return errorCopy;
}

export const supportedLanguages = ["it", "en", "fr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** Language used for the plain `detail` field, which is not localizable. */
export const defaultLanguage: SupportedLanguage = "it";

export type LocalizedMessage = Record<string, string>;

export type ErrorCopyEntry = {
  /** Code exposed to the frontend as `Problem.type`, e.g. "eserviceNotFound" */
  key: string;
  messages: LocalizedMessage;
};

export type UserFacingProblem = Problem & {
  userMessages?: LocalizedMessage;
};

export function applyErrorCopy(
  problem: Problem,
  endpoint: string | undefined,
): UserFacingProblem {
  const endpointCopy = endpoint ? getErrors()[endpoint] : undefined;
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
    userMessages: copy.messages,
  };
}

const output = getErrors();
console.log(JSON.stringify(output, null, 2));

const problem: Problem = {
  type: "eServiceDescriptorNotFound",
  status: 400,
  title: "eServiceDescriptorNotFound",
  correlationId: "correlationId",
  detail: "Detail message",
  errors: [
    {
      code: "004-0001",
      detail: "Detail message",
    },
  ],
};

console.log("-----------------------");
const parsedProblem = applyErrorCopy(problem, "GET /catalog/:eserviceId");

console.log(JSON.stringify(parsedProblem, null, 2));
