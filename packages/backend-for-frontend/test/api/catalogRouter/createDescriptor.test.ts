/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { getMockApiCreatedResource } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/descriptors", () => {
  const mockInstanceEServiceSeed = {
    isSignalHubEnabled: true,
    isConsumerDelegable: true,
    isClientAccessDelegable: true,
  };
  const mockEServiceId = generateId<EServiceId>();
  const mockApiCreatedResource = getMockApiCreatedResource(mockEServiceId);

  const makeRequest = async (
    token: string,
    eServiceId: unknown = mockEServiceId
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockInstanceEServiceSeed);

  beforeEach(() => {
    services.catalogService.createDescriptor = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
