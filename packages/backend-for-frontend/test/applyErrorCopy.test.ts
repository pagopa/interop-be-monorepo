import type { ErrorMessage } from "pagopa-interop-models";
import type { Problem } from "pagopa-interop-models";

import { describe, it, expect } from "vitest";

import { applyErrorCopy } from "../src/model/applyError.js";

describe("applyErrorCopy", () => {
  const commonErrorMessages: ErrorMessage[] = [
    {
      process: "Tenant Process",
      error: "expirationDateCannotBeInThePast",
      errorCode: "005-0014",
      bffEndpoint: "GET /tenant/:tenantId",
      copy: {
        it: "Un messaggio di errore",
        en: "Some error message",
      },
    },
  ];

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
      commonErrorMessages
    );
    expect({
      ...result,
      detail: undefined,
      userMessage: undefined,
    }).toEqual({
      ...problem,
      detail: undefined,
    });

    expect(result.userMessage).toBe("Un messaggio di errore");
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
      commonErrorMessages
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
      commonErrorMessages
    );
    expect(result).toEqual(problem);
  });

  it("should ignore incomplete copies and trim generated messages", () => {
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
    const errorMessages: ErrorMessage[] = [
      {
        process: "Tenant Process",
        error: "expirationDateCannotBeInThePast",
        errorCode: "",
        bffEndpoint: "GET /tenant/:tenantId",
        copy: {
          it: "",
          en: "",
        },
      },
      {
        process: "Tenant Process",
        error: "expirationDateCannotBeInThePast",
        errorCode: "005-0014",
        bffEndpoint: "GET /tenant/:tenantId",
        copy: {
          it: " ",
          en: " ",
        },
      },
      {
        process: "Tenant Process",
        error: "expirationDateCannotBeInThePast",
        errorCode: "005-0014",
        bffEndpoint: "GET /tenant/:tenantId",
        copy: {
          it: "  Messaggio valido  ",
          en: "",
        },
      },
    ];

    const result = applyErrorCopy(
      problem,
      "GET /tenant/:tenantId",
      errorMessages
    );

    expect(result.userMessage).toBe("Messaggio valido");
  });

  it("should fall back to Italian when the selected English copy is missing", () => {
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
      [
        {
          ...commonErrorMessages[0],
          copy: {
            ...commonErrorMessages[0].copy,
            en: " ",
          },
        },
      ],
      "en"
    );

    expect(result.userMessage).toBe("Un messaggio di errore");
  });
});
