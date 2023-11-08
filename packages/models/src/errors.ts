/* eslint-disable max-classes-per-file */
import { P, match } from "ts-pattern";

export class ApiError extends Error {
  public code: string;
  public httpStatus: number;
  public title: string;
  public detail: string;
  public correlationId?: string;

  constructor({
    code,
    httpStatus,
    title,
    detail,
    correlationId,
  }: {
    code: string;
    httpStatus: number;
    title: string;
    detail: string;
    correlationId?: string;
  }) {
    super();
    this.code = code;
    this.httpStatus = httpStatus;
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

export function makeApiProblem(error: unknown): Problem {
  const makeProblem = ({
    code,
    httpStatus,
    title,
    detail,
    correlationId,
  }: ApiError): Problem => ({
    type: "https://docs.pagopa.it/interoperabilita-1/", // TODO change this with properly schema definition URI
    title,
    status: httpStatus,
    detail,
    correlationId,
    errors: [
      {
        code,
        detail,
      },
    ],
  });

  return match<unknown, Problem>(error)
    .with(P.instanceOf(ApiError), (error) => makeProblem(error))
    .otherwise(() => makeProblem(genericError("Unexpected error")));
}

export function authenticationSaslFailed(message: string): ApiError {
  return {
    code: "9000",
    httpStatus: 500,
    title: "SASL authentication fails",
    detail: `SALS Authentication fails with this error : ${message}`,
  };
}

export function genericError(details: string): ApiError {
  return new ApiError({
    detail: details,
    code: `9991`,
    httpStatus: 500,
    title: "Unexpected error",
  });
}

export function unauthorizedError(details: string): ApiError {
  return new ApiError({
    detail: details,
    code: `9991`,
    httpStatus: 401,
    title: "Unauthorized",
  });
}

export function missingClaim(claimName: string): ApiError {
  return new ApiError({
    detail: `Claim ${claimName} has not been passed`,
    code: "9990",
    httpStatus: 400,
    title: "Claim has not been passed",
  });
}

export function missingHeader(headerName?: string): ApiError {
  const title = "Header has not been passed";
  return new ApiError({
    detail: headerName
      ? `Header ${headerName} not existing in this request`
      : title,
    code: "9994",
    httpStatus: 400,
    title,
  });
}

export const missingBearer: ApiError = new ApiError({
  detail: `Authorization Illegal header key.`,
  code: "9999",
  httpStatus: 400,
  title: "Bearer token has not been passed",
});
