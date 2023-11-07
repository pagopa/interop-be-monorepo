/* eslint-disable max-classes-per-file */
import { P, match } from "ts-pattern";

export type ApiError = {
  code: string;
  httpStatus: number;
  title: string;
  detail: string;
  correlationId?: string;
};

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
    .with(
      {
        code: P.string,
        httpStatus: P.number,
        title: P.string,
        detail: P.string,
        correlationId: P.string.optional(),
      },
      (error) =>
        makeProblem({
          code: error.code,
          httpStatus: error.httpStatus,
          title: error.title,
          detail: error.detail,
          correlationId: error.correlationId,
        })
    )
    .otherwise(() =>
      makeProblem({
        code: "9991",
        httpStatus: 500,
        title: "Unexpected error",
        detail: "Generic error",
      })
    );
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
  return {
    detail: details,
    code: `9991`,
    httpStatus: 500,
    title: "Unexpected error",
  };
}

export function unauthorizedError(details: string): ApiError {
  return {
    detail: details,
    code: `9991`,
    httpStatus: 401,
    title: "Unauthorized",
  };
}

export function missingClaim(claimName: string): ApiError {
  return {
    detail: `Claim ${claimName} has not been passed`,
    code: "9990",
    httpStatus: 400,
    title: "Claim has not been passed",
  };
}

export function missingHeader(headerName?: string): ApiError {
  const title = "Header has not been passed";
  return {
    detail: headerName
      ? `Header ${headerName} not existing in this request`
      : title,
    code: "9994",
    httpStatus: 400,
    title,
  };
}

export function missingBearer(): ApiError {
  return {
    detail: `Authorization Illegal header key.`,
    code: "9999",
    httpStatus: 400,
    title: "Bearer token has not been passed",
  };
}

export function eServiceNotFound(eServiceId: string): ApiError {
  return {
    detail: `EService ${eServiceId} not found`,
    code: "0007",
    httpStatus: 404,
    title: "EService not found",
  };
}
