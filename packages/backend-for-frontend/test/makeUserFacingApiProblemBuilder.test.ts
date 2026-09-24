/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AxiosError, AxiosHeaders } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateToken } from "pagopa-interop-commons-test";
import { ErrorCopy } from "pagopa-interop-error-message-parser";
import { emptyErrorMapper, Problem } from "pagopa-interop-models";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { appBasePath } from "../src/config/appBasePath.js";
import { makeUserFacingApiProblemBuilder } from "../src/model/applyError.js";
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

    const problem = makeApiProblem(makeAxiosError(error), emptyErrorMapper, {
      ...getMockContext({}),
      endpoint: "GET /tenant/:tenantId",
    });
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

    const problem = makeApiProblem(makeAxiosError(error), emptyErrorMapper, {
      ...getMockContext({}),
      endpoint: "GET /tenant/:tenantId",
    });
    expect(problem).toEqual(error);
  });

  it("should correctly show the localised user messages with replaced values", async () => {
    const mockEServiceArchivingReasonSeed: bffApi.EServiceArchivingSeed = {
      archivingReason: "Generic archiving reason",
      gracePeriodDays: 60,
    };

    const token = generateToken(authRole.ADMIN_ROLE);
    clients.catalogProcessClient.scheduleEServiceArchiving = vi
      .fn()
      .mockRejectedValue(
        makeAxiosError({
          type: "about:blank",
          status: 400,
          title: "gracePeriodDaysLowerThanDescriptor",
          correlationId: generateId(),
          detail: "Detail message",
          errors: [
            {
              code: "001-0070",
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
          `${appBasePath}/eservices/${mockApiProducerEServiceDetails.id}/scheduleArchive`
        )
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send(mockEServiceArchivingReasonSeed);

    const res = await makeRequest();
    const body = res.body;
    expect(body).toHaveProperty("userMessages");
    const itMessage = `Non è stato possibile archiviare ${mockApiProducerEServiceDetails.name}`;
    const enMessage = `${mockApiProducerEServiceDetails.name} was not archived`;
    expect(body.userMessages).toEqual({
      it: itMessage,
      en: enMessage,
    });
    expect(body.detail).toEqual(itMessage);
  });
});
