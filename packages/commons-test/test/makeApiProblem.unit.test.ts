import { constants } from "http2";
import {
  ApiError,
  CommonErrorCodes,
  Problem,
  badRequestError,
  commonErrorCodes,
  emptyErrorMapper,
  featureFlagNotEnabled,
  makeApiProblemBuilder,
  serviceErrorCode,
  tokenVerificationFailed,
  tooManyRequestsError,
  unauthorizedError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getMockContext } from "../src/testUtils.js";

export const testErrorCodes = {
  testError1: "0001",
  testError2: "0002",
  testError3: "0003",
};

export type TestErrorCodes = keyof typeof testErrorCodes;

export function testError1(): ApiError<TestErrorCodes> {
  return new ApiError({
    detail: "This is a test error 1",
    code: "testError1",
    title: "Test Error 1",
  });
}

export function testError2(): ApiError<TestErrorCodes> {
  return new ApiError({
    detail: "This is a test error 2",
    code: "testError2",
    title: "Test Error 2",
  });
}

export function testError3(): ApiError<TestErrorCodes> {
  return new ApiError({
    detail: "This is a test error 3",
    code: "testError3",
    title: "Test Error 3",
  });
}

const {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} = constants;

const defaultTestErrorMapper = (
  error: ApiError<TestErrorCodes | CommonErrorCodes>
): number =>
  match(error.code)
    .with("testError1", () => HTTP_STATUS_BAD_REQUEST)
    .with("testError2", () => HTTP_STATUS_NOT_FOUND)
    .otherwise(() => HTTP_STATUS_INTERNAL_SERVER_ERROR);

const testProblem: Problem = {
  type: "about:blank",
  title: "Test Problem",
  status: HTTP_STATUS_BAD_REQUEST,
  detail: "This is a test problem",
  errors: [
    { code: "000-0001", detail: "This is a test problem" },
    { code: "000-0002", detail: "This is a test problem" },
  ],
  correlationId: "test-correlation-id",
};
const testProblemResponse = {
  response: { status: HTTP_STATUS_BAD_REQUEST, data: testProblem },
};

describe("makeApiProblem", () => {
  const makeApiProblem = makeApiProblemBuilder(testErrorCodes);

  it.each([
    [testError1(), HTTP_STATUS_BAD_REQUEST],
    [testError2(), HTTP_STATUS_NOT_FOUND],
    [testError3(), HTTP_STATUS_INTERNAL_SERVER_ERROR],
  ])(
    "should create a Problem from the $title ApiError using the error mapper to map the status code",
    (error, expectedStatus) => {
      const problem = makeApiProblem(
        error,
        defaultTestErrorMapper,
        getMockContext({})
      );
      expect(problem).toEqual({
        type: "about:blank",
        status: expectedStatus,
        title: error.title,
        correlationId: expect.any(String),
        detail: error.detail,
        errors: [
          {
            code: `000-${testErrorCodes[error.code]}`,
            detail: error.detail,
          },
        ],
      });
    }
  );

  it.each([
    [badRequestError("test"), HTTP_STATUS_BAD_REQUEST],
    [tokenVerificationFailed("test", "test"), HTTP_STATUS_UNAUTHORIZED],
    [unauthorizedError("test"), HTTP_STATUS_FORBIDDEN],
    [featureFlagNotEnabled("test"), HTTP_STATUS_FORBIDDEN],
    [tooManyRequestsError("test"), HTTP_STATUS_TOO_MANY_REQUESTS],
  ])(
    "Should create a Problem from the $title common ApiError using the common default error mapper to map the status code",
    (error, expectedStatus) => {
      const problem = makeApiProblem(
        error,
        defaultTestErrorMapper,
        getMockContext({})
      );
      expect(problem).toEqual({
        type: "about:blank",
        status: expectedStatus,
        title: error.title,
        correlationId: expect.any(String),
        detail: error.detail,
        errors: [
          {
            code: `000-${commonErrorCodes[error.code]}`,
            detail: error.detail,
          },
        ],
      });
    }
  );

  it.each(Object.entries(serviceErrorCode))(
    "Should create a Problem and add the right code prefix: %s",
    (serviceName, expectedPrefix) => {
      const error = testError1();
      const problem = makeApiProblem(
        testError1(),
        defaultTestErrorMapper,
        getMockContext({
          serviceName,
        })
      );
      expect(problem).toEqual({
        type: "about:blank",
        status: defaultTestErrorMapper(error),
        title: error.title,
        correlationId: expect.any(String),
        detail: error.detail,
        errors: [
          {
            code: `${expectedPrefix}-${testErrorCodes[error.code]}`,
            detail: error.detail,
          },
        ],
      });
    }
  );

  it("Should log the problem details", () => {
    const error = testError1();
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");
    makeApiProblem(error, defaultTestErrorMapper, context);
    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Test Error 1.*detail: This is a test error 1.*original error: Error: This is a test error 1.*/
      )
    );
  });

  it("Should log the operational log message when passed as parameter", () => {
    const operationalLogMessage = "This is an operational log message";
    const error = testError1();
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");

    makeApiProblem(error, defaultTestErrorMapper, context);
    expect(context.logger.warn).not.toHaveBeenCalledWith(operationalLogMessage);

    makeApiProblem(
      error,
      defaultTestErrorMapper,
      context,
      operationalLogMessage
    );

    expect(context.logger.warn).toHaveBeenCalledWith(operationalLogMessage);
  });

  it("Should create a generic Problem from a ZodError, and log the ZodError details", () => {
    const { error } = z
      .object({
        name: z.string(),
        age: z.number().int(),
      })
      .safeParse({
        name: 1,
      });

    const context = getMockContext({});
    vi.spyOn(context.logger, "error");
    const problem = makeApiProblem(error, defaultTestErrorMapper, context);

    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Unexpected error.*detail: Unexpected error.*original error: Validation error: Expected string, received number at "name"; Required at "age".*/
      )
    );
    expect(problem).toEqual({
      type: "about:blank",
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      title: "Unexpected error",
      correlationId: expect.any(String),
      detail: "Unexpected error",
      errors: [
        {
          code: `000-${commonErrorCodes.genericError}`,
          detail: "Unexpected error",
        },
      ],
    });
  });

  it("Should create a generic Problem from an unknown error, and log the Error details", () => {
    const error = new Error("This is an unknown error");
    const context = getMockContext({});
    vi.spyOn(context.logger, "error");
    const problem = makeApiProblem(error, defaultTestErrorMapper, context);

    expect(context.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Unexpected error.*detail: Unexpected error.*original error: Error: This is an unknown error.*/
      )
    );
    expect(problem).toEqual({
      type: "about:blank",
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      title: "Unexpected error",
      correlationId: expect.any(String),
      detail: "Unexpected error",
      errors: [
        {
          code: `000-${commonErrorCodes.genericError}`,
          detail: "Unexpected error",
        },
      ],
    });
  });

  it("Should make a Problem passthrough as it is, including the status code", () => {
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");

    const problemPassthrough = makeApiProblem(
      testProblemResponse,
      emptyErrorMapper, // No need for a mapper here, error is already a Problem with status code
      context
    );

    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Test Problem.*detail: This is a test problem.*/
      )
    );
    expect(problemPassthrough).toEqual({
      type: "about:blank",
      status: testProblemResponse.response.status,
      title: testProblemResponse.response.data.title,
      correlationId: expect.any(String),
      detail: testProblemResponse.response.data.detail,
      errors: [
        ...testProblemResponse.response.data.errors.map((error) => ({
          code: error.code,
          detail: error.detail,
        })),
      ],
    });
  });
});

describe("makeApiProblem - problemErrorsPassthrough = false", () => {
  const makeApiProblem = makeApiProblemBuilder(testErrorCodes, {
    problemErrorsPassthrough: false,
  });

  it("Should NOT make a Problem passthrough, and return a generic Problem instead", () => {
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");

    const problemPassthrough = makeApiProblem(
      testProblemResponse,
      emptyErrorMapper,
      context
    );

    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Unexpected error.*detail: Unexpected error.*original error: Test Problem, code 000-0001, This is a test problem.*/
      )
    );
    expect(problemPassthrough).toEqual({
      type: "about:blank",
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      title: "Unexpected error",
      correlationId: expect.any(String),
      detail: "Unexpected error",
      errors: [
        {
          code: `000-${commonErrorCodes.genericError}`,
          detail: "Unexpected error",
        },
      ],
    });
  });
});

describe("makeApiProblem - forceGenericProblemOn500 = true", () => {
  const makeApiProblem = makeApiProblemBuilder(testErrorCodes, {
    forceGenericProblemOn500: true,
  });

  it("Should create a generic Problem from an ApiError mapped to 500, but log the error details", () => {
    const error = testError1();
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");

    const problem = makeApiProblem(
      error,
      () => HTTP_STATUS_INTERNAL_SERVER_ERROR,
      context
    );

    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Test Error 1.*detail: This is a test error 1.* forceGenericProblemOn500 is set to true, returning generic problem.*/
      )
    );
    expect(problem).toEqual({
      type: "about:blank",
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      title: "Unexpected error",
      correlationId: expect.any(String),
      detail: "Unexpected error",
      errors: [
        {
          code: `000-${commonErrorCodes.genericError}`,
          detail: "Unexpected error",
        },
      ],
    });
  });

  it("Should create a generic Problem when a Problem passes through with status 500, but log the Problem details", () => {
    const context = getMockContext({});
    vi.spyOn(context.logger, "warn");

    const problemResponse = {
      response: {
        status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
        data: {
          ...testProblem,
          status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
        },
      },
    };

    const problemPassthrough = makeApiProblem(
      problemResponse,
      emptyErrorMapper,
      context
    );

    expect(context.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /.*title: Test Problem.*detail: This is a test problem.* forceGenericProblemOn500 is set to true, returning generic problem.*/
      )
    );
    expect(problemPassthrough).toEqual({
      type: "about:blank",
      status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
      title: "Unexpected error",
      correlationId: expect.any(String),
      detail: "Unexpected error",
      errors: [
        {
          code: `000-${commonErrorCodes.genericError}`,
          detail: "Unexpected error",
        },
      ],
    });
  });
});
