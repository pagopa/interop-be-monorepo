/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AxiosError, AxiosHeaders } from "axios";
import { getMockContext } from "pagopa-interop-commons-test";
import { ErrorCopy } from "pagopa-interop-error-message-parser";
import { emptyErrorMapper, Problem } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { makeUserFacingApiProblemBuilder } from "../src/model/applyError.js";

export const testErrorCodes = {
  testBadRequestError: "0001",
  testNotFoundError: "0002",
  testGenericError: "0003",
};

describe("makeUserFacingApiProblemBuilder", () => {
  const commonErrorCopy: ErrorCopy = {
    "GET /tenant/:tenantId": {
      "005-0014": {
        key: "005-0014",
        messages: {
          it: "Un messaggio di errore",
          en: "Some error message",
        },
      },
    },
  };
  const makeApiProblem = makeUserFacingApiProblemBuilder(
    testErrorCodes,
    {
      forceGenericProblemOn500: true,
      problemErrorsPassthrough: true,
    },
    commonErrorCopy
  );

  it("should create a Problem with the localised user message from an Axios Error found in the error copy", () => {
    const error: Problem = {
      type: "about:blank",
      status: 400,
      title: "expirationDateCannotBeInThePast",
      correlationId: "correlationId",
      detail: "Detail message",
      errors: [
        {
          code: "005-0014",
          detail: "Detail message",
        },
      ],
    };

    const problem = makeApiProblem(
      new AxiosError(error.detail, "ERR_BAD_REQUEST", undefined, undefined, {
        data: error,
        status: error.status,
        statusText: "Bad Request",
        headers: new AxiosHeaders(),
        config: {
          headers: new AxiosHeaders(),
        },
      }),
      emptyErrorMapper,
      {
        ...getMockContext({}),
        endpoint: "GET /tenant/:tenantId",
      }
    );
    expect(problem).toEqual({
      type: "about:blank",
      status: 400,
      title: error.title,
      correlationId: expect.any(String),
      detail: "Un messaggio di errore",
      errors: [
        {
          code: "005-0014",
          detail: "Detail message",
        },
      ],
      userMessages: {
        it: "Un messaggio di errore",
        en: "Some error message",
      },
    });
  });

  it("should create a Problem without the localised user message from an Axios Error when not found in the error copy", () => {
    const error: Problem = {
      type: "about:blank",
      status: 400,
      title: "anotherError",
      correlationId: "correlationId",
      detail: "Detail message",
      errors: [
        {
          code: "001-0015",
          detail: "Detail message",
        },
      ],
    };

    const problem = makeApiProblem(
      new AxiosError(error.detail, "ERR_BAD_REQUEST", undefined, undefined, {
        data: error,
        status: error.status,
        statusText: "Bad Request",
        headers: new AxiosHeaders(),
        config: {
          headers: new AxiosHeaders(),
        },
      }),
      emptyErrorMapper,
      {
        ...getMockContext({}),
        endpoint: "GET /tenant/:tenantId",
      }
    );
    expect(problem).toEqual(error);
  });
});
