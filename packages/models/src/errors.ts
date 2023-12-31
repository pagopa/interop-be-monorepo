/* eslint-disable max-classes-per-file */
import { P, match } from "ts-pattern";

export class ApiError<T> extends Error {
  public code: T;
  public title: string;
  public detail: string;
  public correlationId?: string;

  constructor({
    code,
    title,
    detail,
    correlationId,
  }: {
    code: T;
    title: string;
    detail: string;
    correlationId?: string;
  }) {
    super();
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.correlationId = correlationId;
  }
}

export type ProblemError = {
  code: string;
  detail: string;
};

export type Problem = {
  type: string;
  status: number;
  title: string;
  correlationId?: string;
  detail: string;
  errors: ProblemError[];
};

export function makeApiProblemBuilder<T extends string>(errors: {
  [K in T]: string;
}): (
  error: unknown,
  httpMapper: (apiError: ApiError<T | CommonErrorCodes>) => number
) => Problem {
  const allErrors = { ...errorCodes, ...errors };
  return (error, httpMapper) => {
    const makeProblem = (
      httpStatus: number,
      { code, title, detail, correlationId }: ApiError<T | CommonErrorCodes>
    ): Problem => ({
      type: "about:blank",
      title,
      status: httpStatus,
      detail,
      correlationId,
      errors: [
        {
          code: allErrors[code],
          detail,
        },
      ],
    });

    return match<unknown, Problem>(error)
      .with(P.instanceOf(ApiError<T | CommonErrorCodes>), (error) =>
        makeProblem(httpMapper(error), error)
      )
      .otherwise(() => makeProblem(500, genericError("Unexpected error")));
  };
}

const errorCodes = {
  authenticationSaslFailed: "9000",
  operationForbidden: "9989",
  missingClaim: "9990",
  genericError: "9991",
  unauthorizedError: "9991",
  missingHeader: "9994",
} as const;

export type CommonErrorCodes = keyof typeof errorCodes;

export function authenticationSaslFailed(
  message: string
): ApiError<CommonErrorCodes> {
  return new ApiError({
    code: "authenticationSaslFailed",
    title: "SASL authentication fails",
    detail: `SALS Authentication fails with this error : ${message}`,
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

export function missingClaim(claimName: string): ApiError<CommonErrorCodes> {
  return new ApiError({
    detail: `Claim ${claimName} has not been passed`,
    code: "missingClaim",
    title: "Claim has not been passed",
  });
}

export function missingHeader(headerName?: string): ApiError<CommonErrorCodes> {
  const title = "Header has not been passed";
  return new ApiError({
    detail: headerName
      ? `Header ${headerName} not existing in this request`
      : title,
    code: "missingHeader",
    title,
  });
}

export const missingBearer: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Authorization Illegal header key.`,
  code: "missingHeader",
  title: "Bearer token has not been passed",
});

export const operationForbidden: ApiError<CommonErrorCodes> = new ApiError({
  detail: `Insufficient privileges`,
  code: "operationForbidden",
  title: "Insufficient privileges",
});
