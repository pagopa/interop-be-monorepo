/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPresignedUrl } from "../../mockUtils.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";

describe("API GET /import/eservices/presignedUrl", () => {
  const defaultQuery = {
    fileName: "fileName",
  };
  const mockPresignedUrl = getMockBffApiPresignedUrl();

  beforeEach(() => {
    services.catalogService.generatePutPresignedUrl = vi
      .fn()
      .mockResolvedValue(mockPresignedUrl);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/import/eservices/presignedUrl`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPresignedUrl);
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
      services.catalogService.generatePutPresignedUrl = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid query", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {} as unknown as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
