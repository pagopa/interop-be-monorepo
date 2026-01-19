/* eslint-disable max-classes-per-file */
import { constants } from "http2";
import { P, match } from "ts-pattern";
import { z, ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { AxiosError, isAxiosError } from "axios";
import { CorrelationId } from "./brandedIds.js";
import { serviceErrorCode, ServiceName } from "./services.js";

const {
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_IMPLEMENTED,
} = constants;

export const emptyErrorMapper = (): number => HTTP_STATUS_INTERNAL_SERVER_ERROR;

export class ApiError<T> extends Error {
  /* TODO consider refactoring how the code property is used:
    From the API point of view, it is an info present only in the single error
    in the errors array - not in the main Problem response.
    However, at the moment we need it because it is used around the codebase to
    map ApiError to a specific HTTP status code.
    */
  public code: T;
  public title: string;
  public detail: string;
  public errors: Array<{ code: T; detail: string }>;

  constructor({
    code,
    title,
    detail,
    errors,
  }: {
    code: T;
    title: string;
    detail: string;
    errors?: Error[];
  }) {
    super(detail);
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors =
      errors && errors.length > 0
        ? errors.map((e) => ({ code, detail: e.message }))
        : [{ code, detail }];
  }
}

export class InternalError<T> extends Error {
  public code: T;
  public detail: string;

  constructor({ code, detail }: { code: T; detail: string }) {
    super(detail);
    this.code = code;
    this.detail = detail;
  }
}

const ProblemError = z.strictObject({
  code: z.string(),
  detail: z.string(),
});

export const ProblemSchema = z.strictObject({
  type: z.string(),
  status: z.number(),
  title: z.string(),
  correlationId: z.string().optional(),
  detail: z.string().optional(),
  errors: z.array(ProblemError).min(1).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

type MakeApiProblemFn<T extends string> = (
  error: unknown,
  httpMapper: (apiError: ApiError<T | CommonErrorCodes>) => number,
  context: {
    logger: {
      error: (message: string) => void;
      warn: (message: string) => void;
    };
    correlationId: CorrelationId;
    serviceName: string;
  },
  operationalLogMessage?: string
) => Problem;

const makeProblemLogString = (
  problem: Problem,
  originalError: unknown
): string => {
  const errorsString = problem.errors
    ? ` - errors: ${problem.errors
        .map((e) => `${e.code}, ${e.detail}`)
        .join("; ")}`
    : "";
  return `- title: ${problem.title} - detail: ${problem.detail}${errorsString} - original error: ${originalError}`;
};

type ProblemBuilderOptions = {
  /**
   * If true, allows Problem objects received from downstream services
   * to be passed through directly. If false, they are treated as generic errors.
   *
   * @default true
   */
  problemErrorsPassthrough?: boolean;
  /**
   * If true, return a generic problem whenever an error is mapped to HTTP 500, hiding the underlying error info.
   * This also applies to 500 errors passing through from downstream services.
   *
   * @default false
   */
  forceGenericProblemOn500?: boolean;
};

export function makeApiProblemBuilder<T extends string>(
  errors: {
    [K in T]: string;
  },
  options: ProblemBuilderOptions = {}
): MakeApiProblemFn<T> {
  const { problemErrorsPassthrough = true, forceGenericProblemOn500 = false } =
    options;
  const allErrors = { ...commonErrorCodes, ...errors };

  function retrieveServiceErrorCode(serviceName: string): string {
    const serviceNameParsed = ServiceName.safeParse(serviceName);
    return serviceNameParsed.success
      ? serviceErrorCode[serviceNameParsed.data]
      : "000";
  }

  return (
    error,
    httpMapper,
    { logger, correlationId, serviceName },
    operationalLogMessage
  ) => {
    const serviceErrorCode = retrieveServiceErrorCode(serviceName);

    const makeProblem = (
      httpStatus: number,
      { title, detail, errors }: ApiError<T | CommonErrorCodes>
    ): Problem => ({
      type: "about:blank",
      title,
      status: httpStatus,
      detail,
      correlationId,
      errors: errors.map(({ code, detail }) => ({
        code: `${serviceErrorCode}-${allErrors[code]}`,
        detail,
      })),
    });

    const genericProblem = makeProblem(
      HTTP_STATUS_INTERNAL_SERVER_ERROR,
      genericError("Unexpected error")
    );

    if (operationalLogMessage) {
      logger.warn(operationalLogMessage);
    }

    return match<unknown, Problem>(error)
      .with(P.instanceOf(ApiError<T | CommonErrorCodes>), (error) => {
        const mappedCode = httpMapper(error);
        const code =
          mappedCode === HTTP_STATUS_INTERNAL_SERVER_ERROR
            ? defaultCommonErrorMapper(error.code as CommonErrorCodes)
            : mappedCode;

        const isInternalServerError =
          code === HTTP_STATUS_INTERNAL_SERVER_ERROR;

        const problem = makeProblem(code, error);
        const problemLogString = makeProblemLogString(problem, error);

        if (forceGenericProblemOn500 && isInternalServerError) {
          logger.warn(
            `${problemLogString}. forceGenericProblemOn500 is set to true, returning generic problem`
          );
          return genericProblem;
        }

        logger.warn(problemLogString);
        return problem;
      })
      .with(
        /* this case is to allow a passthrough of Problem errors, so that
           services that call other interop services can forward Problem errors
           as they are, without the need to explicitly handle them */
        P.intersection(
          P.when((e): e is AxiosError<Problem> => isAxiosError(e)),
          {
            response: {
              // Matching also AxiosError content to ensure data matches Problem type
              status: P.number,
              data: {
                type: "about:blank",
                title: P.string,
                status: P.number,
                detail: P.string,
                errors: P.array({
                  code: P.string,
                  detail: P.string,
                }),
                correlationId: P.string.optional(),
              },
            },
          }
        ),
        (e) => {
          const receivedProblem: Problem = e.response.data;
          if (problemErrorsPassthrough) {
            const problemLogString = makeProblemLogString(
              receivedProblem,
              error
            );

            if (
              forceGenericProblemOn500 &&
              (e.response.status === HTTP_STATUS_INTERNAL_SERVER_ERROR ||
                receivedProblem.status === HTTP_STATUS_INTERNAL_SERVER_ERROR)
            ) {
              logger.warn(
                `${problemLogString}. forceGenericProblemOn500 is set to true, returning generic problem`
              );
              return genericProblem;
            }

            logger.warn(problemLogString);
            return receivedProblem;
          } else {
            logger.warn(
              makeProblemLogString(
                genericProblem,
                `${receivedProblem.title} - status ${receivedProblem.status}`
              )
            );
            return genericProblem;
          }
        }
      )
      .with(P.instanceOf(ZodError), (error) => {
        // Zod errors shall always be caught and handled throwing
        // an ApiError. If a ZodError arrives here we log it and
        // return a generic problem
        const zodError = fromZodError(error);
        logger.error(makeProblemLogString(genericProblem, zodError));
        return genericProblem;
      })
      .otherwise((error: unknown): Problem => {
        logger.error(makeProblemLogString(genericProblem, error));
        return genericProblem;
      });
  };
}

export const commonErrorCodes = {
  authenticationSaslFailed: "9000",
  jwtDecodingError: "9001",
  htmlTemplateInterpolationError: "9002",
  pdfGenerationError: "9003",
  operationForbidden: "9989",
  invalidClaim: "9990",
  genericError: "9991",
  thirdPartyCallError: "9992",
  unauthorizedError: "9993",
  missingHeader: "9994",
  tokenGenerationError: "9995",
  missingRSAKey: "9996",
  missingKafkaMessageData: "9997",
  kafkaMessageProcessError: "9998",
  badRequestError: "9999",
  jwkDecodingError: "10000",
  notAllowedPrivateKeyException: "10001",
  missingRequiredJWKClaim: "10002",
  invalidPublicKey: "10003",
  tooManyRequestsError: "10004",
  notAllowedCertificateException: "10005",
  jwksSigningKeyError: "10006",
  badBearerToken: "10007",
  invalidKeyLength: "10008",
  notAnRSAKey: "10009",
  invalidEserviceInterfaceFileDetected: "10010",
  openapiVersionNotRecognized: "10011",
  interfaceExtractingInfoError: "10012",
  invalidContentTypeDetected: "10013",
  tokenVerificationFailed: "10014",
  invalidEserviceInterfaceData: "10015",
  soapFileParsingError: "10016",
  interfaceExtractingSoapFieldValueError: "10017",
  soapFileCreatingError: "10018",
  notAllowedMultipleKeysException: "10019",
  featureFlagNotEnabled: "10020",
  kafkaApplicationAuditingFailed: "10021",
  fallbackApplicationAuditingFailed: "10022",
  invalidSqsMessage: "10023",
  decodeSQSMessageError: "10024",
  pollingMaxRetriesExceeded: "10025",
  invalidServerUrl: "10026",
  hyperlinkDetectionError: "10027",
} as const;

export type CommonErrorCodes = keyof typeof commonErrorCodes;

export function parseErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return fromZodError(error).message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return `${JSON.stringify(error)}`;
}

/* ===== Internal Error ===== */

export function missingKafkaMessageDataError(
  dataName: string,
  eventType: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "missingKafkaMessageData",
    detail: `"Invalid message: missing data '${dataName}' in ${eventType} event"`,
  });
}

export function kafkaApplicationAuditingFailed(): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "kafkaApplicationAuditingFailed",
    detail: "Kafka application auditing failed",
  });
}

export function fallbackApplicationAuditingFailed(): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "fallbackApplicationAuditingFailed",
    detail: `Fallback application auditing failed`,
  });
}

export function invalidSqsMessage(
  messageId: string | undefined,
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "invalidSqsMessage",
    detail: `Error while validating SQS message for id ${messageId}: ${parseErrorMessage(
      error
    )}`,
  });
}

export function decodeSQSMessageError(
  messageId: string | undefined,
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    detail: `Failed to decode SQS ApplicationAuditEvent message with MessageId: ${messageId}. Error details: ${JSON.stringify(
      error
    )}`,
    code: "decodeSQSMessageError",
  });
}

export function genericInternalError(
  message: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "genericError",
    detail: message,
  });
}

export function thirdPartyCallError(
  serviceName: string,
  errorMessage: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "thirdPartyCallError",
    detail: `Error while invoking ${serviceName} external service -> ${errorMessage}`,
  });
}

export function tokenGenerationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "tokenGenerationError",
    detail: `Error during token generation: ${parseErrorMessage(error)}`,
  });
}

export function hyperlinkDetectionError(
  text: string
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "hyperlinkDetectionError",
    detail: `Hyperlink detection error for text ${text}`,
  });
}

export function kafkaMessageProcessError(
  topic: string,
  partition: number,
  {
    offset,
    streamId,
    eventType,
    eventVersion,
    streamVersion,
    correlationId,
    serviceName,
  }: {
    offset: string;
    streamId?: string;
    eventType?: string;
    eventVersion?: number;
    streamVersion?: number;
    correlationId?: string;
    serviceName?: string;
  },
  error?: unknown
): InternalError<CommonErrorCodes> {
  const serviceNamePrefix = serviceName ? `[${serviceName}] -` : "";
  const correlationIdPrefix = correlationId ? `[CID=${correlationId}]` : "";
  const eventTypePrefix = eventType ? `[ET=${eventType}]` : "";
  const eventVersionPrefix = eventVersion ? `[EV=${eventVersion}]` : "";
  const streamVersionPrefix =
    streamVersion !== undefined ? `[SV=${streamVersion}]` : "";
  const streamIdPrefix = streamId ? `[SID=${streamId}]` : "";
  const errorMessage = error ? `${parseErrorMessage(error)}` : "";

  const prefixes = [
    serviceNamePrefix,
    correlationIdPrefix,
    eventTypePrefix,
    eventVersionPrefix,
    streamVersionPrefix,
    streamIdPrefix,
  ].join(" ");

  return new InternalError({
    code: "kafkaMessageProcessError",
    detail: `${prefixes} Error handling Kafka message. Topic: ${topic}. Partition number: ${partition}. Offset: ${offset}. Message: ${errorMessage}`,
  });
}

export function htmlTemplateInterpolationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "htmlTemplateInterpolationError",
    detail: `Error compiling HTML template: ${parseErrorMessage(error)}`,
  });
}

export function pdfGenerationError(
  error: unknown
): InternalError<CommonErrorCodes> {
  return new InternalError({
    code: "pdfGenerationError",
    detail: `Error during pdf generation : ${parseErrorMessage(error)}`,
  });
}

/* ===== API Error ===== */

const defaultCommonErrorMapper = (code: CommonErrorCodes): number =>
  match(code)
    .with("badRequestError", () => HTTP_STATUS_BAD_REQUEST)
    .with("tokenVerificationFailed", () => HTTP_STATUS_UNAUTHORIZED)
    .with(
      "unauthorizedError",
      "operationForbidden",
      () => HTTP_STATUS_FORBIDDEN
    )
    .with("featureFlagNotEnabled", () => HTTP_STATUS_NOT_IMPLEMENTED)
    .with("tooManyRequestsError", () => HTTP_STATUS_TOO_MANY_REQUESTS)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

export function authenticationSaslFailed(
  message: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    code: "authenticationSaslFailed",
    title: "SASL authentication fails",
    detail: `SASL Authentication fails with this error: ${message}`,
  });
}

export function genericError(details: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: details,
    code: "genericError",
    title: "Unexpected error",
  });
}

export function unauthorizedError(details: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: details,
    code: "unauthorizedError",
    title: "Unauthorized",
  });
}

export function badRequestError(
  detail: string,
  errors?: Error[]
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail,
    code: "badRequestError",
    title: "Bad request",
    errors,
  });
}

export function tooManyRequestsError(
  organizationId: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    code: "tooManyRequestsError",
    title: "Too Many Requests",
    detail: `Requests limit exceeded for organization ${organizationId}`,
  });
}

export function invalidClaim(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Claim not valid or missing: ${parseErrorMessage(error)}`,
    code: "invalidClaim",
    title: "Claim not valid or missing",
  });
}

export function jwtDecodingError(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Unexpected error on JWT decoding: ${parseErrorMessage(error)}`,
    code: "jwtDecodingError",
    title: "JWT decoding error",
  });
}

export function tokenVerificationFailed(
  uid: string | undefined,
  selfcareId: string | undefined
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail:
      "Token verification failed" +
      (uid ? " for user " + uid : "") +
      (selfcareId ? " for tenant " + selfcareId : ""),
    code: "tokenVerificationFailed",
    title: "Token verification failed",
  });
}

export function missingHeader(headerName?: string): ApiError<CommonErrorCodes> {
  const title = "Header has not been passed";
  return new ApiError({
    detail: headerName ? `Missing ${headerName} request header` : title,
    code: "missingHeader",
    title,
  });
}

export const badBearerToken: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Bad Bearer Token format in Authorization header`,
  code: "badBearerToken",
  title: "Bad Bearer Token format",
});

export const operationForbidden: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Insufficient privileges`,
  code: "operationForbidden",
  title: "Insufficient privileges",
});

export function jwkDecodingError(error: unknown): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Unexpected error on JWK base64 decoding: ${parseErrorMessage(
      error
    )}`,
    code: "jwkDecodingError",
    title: "JWK decoding error",
  });
}

export function jwksSigningKeyError(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error getting signing key`,
    code: "jwksSigningKeyError",
    title: "JWK signing key error",
  });
}

export function notAllowedPrivateKeyException(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The received key is a private key`,
    code: "notAllowedPrivateKeyException",
    title: "Not allowed private key exception",
  });
}

export function notAllowedCertificateException(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The received key is a certificate`,
    code: "notAllowedCertificateException",
    title: "Not allowed certificate exception",
  });
}

export function notAllowedMultipleKeysException(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The received key contains multiple keys`,
    code: "notAllowedMultipleKeysException",
    title: "Not allowed multiple keys exception",
  });
}

export function missingRequiredJWKClaim(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `One or more required JWK claims are missing`,
    code: "missingRequiredJWKClaim",
    title: "Missing required JWK claims",
  });
}

export function invalidPublicKey(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Public key is invalid`,
    code: "invalidPublicKey",
    title: "Invalid Key",
  });
}

export function invalidKeyLength(
  length: number | undefined,
  minLength: number = 2048
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Invalid RSA key length: ${length} bits. It must be at least ${minLength}`,
    code: "invalidKeyLength",
    title: "Invalid Key length",
  });
}

export function notAnRSAKey(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Provided key is not an RSA key`,
    code: "notAnRSAKey",
    title: "Not an RSA key",
  });
}

export function invalidInterfaceFileDetected(resource: {
  id: string;
  isEserviceTemplate: boolean;
}): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The interface file for ${
      resource.isEserviceTemplate ? "EserviceTemplate" : "EService"
    } with ID ${resource.id} is invalid`,
    code: "invalidEserviceInterfaceFileDetected",
    title: "Invalid interface file detected",
  });
}

export function invalidInterfaceData(resource: {
  id: string;
  isEserviceTemplate: boolean;
}): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The interface data provided for ${
      resource.isEserviceTemplate ? "EserviceTemplate" : "EService"
    } ${resource.id} is invalid`,
    code: "invalidEserviceInterfaceData",
    title: "Invalid interface file data provided",
  });
}

export function openapiVersionNotRecognized(
  version: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `OpenAPI version not recognized - ${version}`,
    code: "openapiVersionNotRecognized",
    title: "OpenAPI version not recognized",
  });
}

export function parsingSoapFileError(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error parsing SOAP file`,
    code: "soapFileParsingError",
    title: "Error parsing SOAP file",
  });
}

export function buildingSoapFileError(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error creating SOAP file`,
    code: "soapFileCreatingError",
    title: "Error creating SOAP file",
  });
}

export function interfaceExtractingInfoError(): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error extracting info from interface file`,
    code: "interfaceExtractingInfoError",
    title: "Error extracting info from interface file",
  });
}
export function interfaceExtractingSoapFieldError(
  fieldName: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Error extracting field ${fieldName} from SOAP file`,
    code: "interfaceExtractingSoapFieldValueError",
    title: "Error extracting field from SOAP file",
  });
}

export function invalidContentTypeDetected(
  resource: {
    id: string;
    isEserviceTemplate: boolean;
  },
  contentType: string,
  technology: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The file uploaded for ${
      resource.isEserviceTemplate ? "EserviceTemplate" : "EService"
    } ${
      resource.id
    } has a contentType ${contentType} not admitted for ${technology} technology`,
    code: "invalidContentTypeDetected",
    title: "Invalid content type detected",
  });
}
export function featureFlagNotEnabled(
  featureFlag: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Feature flag ${featureFlag} is not enabled`,
    code: "featureFlagNotEnabled",
    title: "Feature flag not enabled",
  });
}

export function pollingMaxRetriesExceeded(
  retries: number,
  retryDelayMs: number
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Polling exceeded maximum retries (${retries}) with delay ${retryDelayMs}ms`,
    code: "pollingMaxRetriesExceeded",
    title: "Polling max retries exceeded",
  });
}

export function invalidServerUrl(resource: {
  id: string;
  isEserviceTemplate: boolean;
}): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The interface file for ${
      resource.isEserviceTemplate ? "EserviceTemplate" : "EService"
    } with ID ${resource.id} has invalid server URL`,
    code: "invalidServerUrl",
    title: "Invalid server URL",
  });
}

export function invalidDocumentDetected(
  resourceId: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `The document for Purpose template with ID ${resourceId} is invalid`,
    code: "invalidContentTypeDetected",
    title: "Invalid document detected",
  });
}
