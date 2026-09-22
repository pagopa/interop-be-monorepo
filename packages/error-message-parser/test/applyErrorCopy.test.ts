import type { Problem } from "pagopa-interop-models";

import { describe, it, expect } from "vitest";

import { applyErrorCopy, ErrorCopy } from "../src/index.js";

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
  });
});
