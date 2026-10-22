import type { Problem } from "pagopa-interop-models";

import { ErrorCopy } from "pagopa-interop-error-message-parser";
import { describe, it, expect } from "vitest";

import { applyErrorCopy } from "../src/model/applyError.js";

describe("applyErrorCopy", () => {
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

  it("should correctly apply error copy to a problem object", () => {
    const problem: Problem = {
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
    const result = applyErrorCopy(
      problem,
      "GET /tenant/:tenantId",
      commonErrorCopy
    );
    expect({
      ...result,
      detail: undefined,
      userMessages: undefined,
    }).toEqual({
      ...problem,
      detail: undefined,
    });

    expect(result.userMessages).toEqual({
      it: "Un messaggio di errore",
      en: "Some error message",
    });
    expect(result.detail).toBe("Un messaggio di errore");
  });

  it("should correctly leave unaltered when no matching error copy is found", () => {
    const problem: Problem = {
      type: "about:blank",
      status: 400,
      title: "expirationDateCannotBeInThePast",
      correlationId: "correlationId",
      detail: "Detail message",
      errors: [
        {
          code: "005-0015",
          detail: "Detail message",
        },
      ],
    };
    const result = applyErrorCopy(
      problem,
      "GET /tenant/:tenantId",
      commonErrorCopy
    );
    expect(result).toEqual(problem);
  });

  it("should correctly leave unaltered if there is no matching endpoint", () => {
    const problem: Problem = {
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
    const result = applyErrorCopy(
      problem,
      "GET /non-existent-endpoint",
      commonErrorCopy
    );
    expect(result).toEqual(problem);
  });
});
