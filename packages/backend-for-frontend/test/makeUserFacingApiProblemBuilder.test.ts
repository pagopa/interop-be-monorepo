/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ErrorMessage } from "pagopa-interop-models";

import { AxiosError, AxiosHeaders } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateToken } from "pagopa-interop-commons-test";
import { emptyErrorMapper, Problem } from "pagopa-interop-models";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { UserFacingProblem } from "../src/model/types.js";

import { appBasePath } from "../src/config/appBasePath.js";
import {
  applyPlaceholderToError,
  makeUserFacingApiProblemBuilder,
  placeholderMapperGenerator,
} from "../src/model/applyError.js";
import { getMockBffApiProducerEServiceDetails } from "./mockUtils.js";
import { api, clients, services } from "./vitest.api.setup.js";

export const testErrorCodes = {
  testBadRequestError: "0001",
  testNotFoundError: "0002",
  testGenericError: "0003",
};

describe("makeUserFacingApiProblemBuilder", () => {
  const makeAxiosError = (problem: Problem) =>
    new AxiosError(problem.detail, "ERR_BAD_REQUEST", undefined, undefined, {
      data: problem,
      status: problem.status,
      statusText: "Bad Request",
      headers: new AxiosHeaders(),
      config: {
        headers: new AxiosHeaders(),
      },
    });

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
  const makeApiProblem = makeUserFacingApiProblemBuilder(
    testErrorCodes,
    {
      forceGenericProblemOn500: true,
      problemErrorsPassthrough: true,
    },
    commonErrorMessages
  );
  const makeApiProblemWithoutForce = makeUserFacingApiProblemBuilder(
    testErrorCodes,
    {
      forceGenericProblemOn500: false,
      problemErrorsPassthrough: true,
    },
    commonErrorMessages
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

    const problem = makeApiProblem(makeAxiosError(error), emptyErrorMapper, {
      ...getMockContext({}),
      endpoint: "GET /tenant/:tenantId",
    });
    expect(problem).toEqual({
      type: "about:blank",
      status: 400,
      title: error.title,
      correlationId: expect.any(String),
      detail: "Detail message",
      errors: [
        {
          code: "005-0014",
          detail: "Detail message",
        },
      ],
      userMessage: "Un messaggio di errore",
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

    const problem = makeApiProblem(makeAxiosError(error), emptyErrorMapper, {
      ...getMockContext({}),
      endpoint: "GET /tenant/:tenantId",
    });
    expect(problem).toEqual(error);
  });

  it("should return a generic problem for a 500 Axios Error without a localised user message", () => {
    const error: Problem = {
      type: "about:blank",
      status: 500,
      title: "Internal process error",
      correlationId: "correlationId",
      detail: "Sensitive downstream detail",
      errors: [
        {
          code: "001-0015",
          detail: "Sensitive downstream detail",
        },
      ],
    };

    const problem = makeApiProblemWithoutForce(
      makeAxiosError(error),
      emptyErrorMapper,
      {
        ...getMockContext({}),
        endpoint: "GET /tenant/:tenantId",
      }
    );
    expect(problem.status).toBe(500);
    expect(problem.title).toBe("Unexpected error");
    expect(problem.detail).not.toContain("Sensitive downstream detail");
    expect(problem.userMessage).toBeUndefined();
  });

  it("should keep the localised user message for a 500 Axios Error found in the error copy", () => {
    const error: Problem = {
      type: "about:blank",
      status: 500,
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

    const problem = makeApiProblemWithoutForce(
      makeAxiosError(error),
      emptyErrorMapper,
      {
        ...getMockContext({}),
        endpoint: "GET /tenant/:tenantId",
      }
    );
    expect(problem.status).toBe(500);
    expect(problem.userMessage).toBe("Un messaggio di errore");
  });

  it.each([
    ["it-IT", "it"],
    ["en-US", "en"],
    ["en-GB", "en"],
    ["fr-FR", "en"],
    [undefined, "it"],
  ] as [string | undefined, "it" | "en"][])(
    "should correctly show the localised user messages with replaced values with Accept-Language header %s",
    async (acceptLanguageHeader, expectedLocale) => {
      const mockEServiceBody: bffApi.UpdateEServiceTemplateInstanceSeed = {};

      const token = generateToken(authRole.ADMIN_ROLE);
      clients.catalogProcessClient.updateEServiceTemplateInstanceById = vi
        .fn()
        .mockRejectedValue(
          makeAxiosError({
            type: "about:blank",
            status: 409,
            title: "eServiceNameDuplicateForProducer",
            correlationId: generateId(),
            detail: "Detail message",
            errors: [
              {
                code: "001-007",
                detail: "Detail message",
              },
            ],
          })
        );
      const mockApiProducerEServiceDetails =
        getMockBffApiProducerEServiceDetails();
      services.catalogService.getProducerEServiceDetails = vi
        .fn()
        .mockResolvedValue(mockApiProducerEServiceDetails);

      const makeRequest = async () =>
        request(api)
          .post(
            `${appBasePath}/templates/eservices/${mockApiProducerEServiceDetails.id}`
          )
          .set("Authorization", `Bearer ${token}`)
          .set("X-Correlation-Id", generateId())
          .set("Accept-Language", acceptLanguageHeader ?? "")
          .send(mockEServiceBody);

      const res = await makeRequest();
      const body = res.body;
      expect(body).toHaveProperty("userMessage");
      const itMessage = `Esiste già un e-service con la parola identificativa ${mockApiProducerEServiceDetails.name}. Scegli un'altra parola identificativa.`;
      const enMessage = `There is already an e-service with the identifying word ${mockApiProducerEServiceDetails.name}. Choose a different identifying word.`;
      const expectedDetailMessage =
        expectedLocale === "it" ? itMessage : enMessage;
      expect(body.userMessage).toEqual(expectedDetailMessage);
    }
  );

  describe("placeholder replacement", () => {
    const placeholder = "{identifyingWord}";
    const problem: Problem = {
      type: "about:blank",
      status: 409,
      title: "Conflict",
      detail: "Detail message",
      correlationId: "correlationId",
      errors: [{ code: "001-007", detail: "Detail message" }],
    };
    const errorWithPlaceholder: UserFacingProblem = {
      ...problem,
      userMessage: `Word ${placeholder} is already in use`,
    };

    const generate = (value: string | undefined) =>
      placeholderMapperGenerator(
        () => value,
        (v, message) =>
          v === undefined ? undefined : message.replace(placeholder, () => v),
        vi.fn()
      );

    it("should replace the placeholder in the userMessage", async () => {
      const result = await applyPlaceholderToError(
        errorWithPlaceholder,
        [placeholder],
        () => generate("abc")
      );

      expect(result).toEqual({
        ...errorWithPlaceholder,
        userMessage: "Word abc is already in use",
      });
    });

    it("should drop the userMessage, keeping the rest of the problem, if replace returns undefined", async () => {
      const result = await applyPlaceholderToError(
        errorWithPlaceholder,
        [placeholder],
        () => generate(undefined)
      );

      expect(result).toEqual(problem);
      expect("userMessage" in result).toBe(false);
    });

    it("should leave the error unchanged and call onError if the callback throws", async () => {
      const onError = vi.fn();
      const result = await applyPlaceholderToError(
        errorWithPlaceholder,
        [placeholder],
        () =>
          placeholderMapperGenerator(
            async () => {
              throw new Error("boom");
            },
            (_, message) => message,
            onError
          )
      );

      expect(result).toEqual(errorWithPlaceholder);
      expect(onError).toHaveBeenCalledOnce();
    });

    it("should not call the generator if the userMessage has no placeholder", async () => {
      const generator = vi.fn();
      const error: UserFacingProblem = { ...problem, userMessage: "No info" };

      const result = await applyPlaceholderToError(
        error,
        [placeholder],
        generator
      );

      expect(result).toEqual(error);
      expect(generator).not.toHaveBeenCalled();
    });
  });
});
