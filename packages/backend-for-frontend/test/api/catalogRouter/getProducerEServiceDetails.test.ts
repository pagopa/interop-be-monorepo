/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";
import { getMockBffApiProducerEServiceDetails } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /producers/eservices/:eserviceId", () => {
  const mockApiProducerEServiceDetails = getMockBffApiProducerEServiceDetails();

  beforeEach(() => {
    services.catalogService.getProducerEServiceDetails = vi
      .fn()
      .mockResolvedValue(mockApiProducerEServiceDetails);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/producers/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiProducerEServiceDetails);
  });

  it.each([
    {
      error: eserviceRiskNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(generateId(), generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.getProducerEServiceDetails = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid eServiceId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });
});
