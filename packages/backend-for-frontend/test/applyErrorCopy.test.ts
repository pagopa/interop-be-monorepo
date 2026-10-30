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
        errorCode: null,
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

    expect(result.detail).toBe("Messaggio valido");
    expect(result.userMessages).toEqual({
      it: "Messaggio valido",
      en: undefined,
    });
  });
});
