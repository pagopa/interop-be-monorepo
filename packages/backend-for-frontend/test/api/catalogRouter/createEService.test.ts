/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiCreatedEServiceDescriptor,
  getMockBffApiEServiceSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";

describe("API POST /eservices", () => {
  const mockEServiceSeed = getMockBffApiEServiceSeed();
  const mockCatalogApiEService = getMockCatalogApiEService();
  const mockApiCreatedEServiceDescriptor =
    getMockBffApiCreatedEServiceDescriptor(
      mockCatalogApiEService.id,
      mockCatalogApiEService.descriptors[0].id
    );

  beforeEach(() => {
    clients.catalogProcessClient.createEService = vi
      .fn()
      .mockResolvedValue(mockCatalogApiEService);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.InstanceEServiceSeed = mockEServiceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedEServiceDescriptor);
  });

  it.each([
    { body: {} },
    { body: { ...mockEServiceSeed, extraField: 1 } },
    { body: { ...mockEServiceSeed, isConsumerDelegable: "invalid" } },
    {
      body: { ...mockEServiceSeed, isClientAccessDelegable: "invalid" },
    },
    { body: { ...mockEServiceSeed, isSignalHubEnabled: "invalid" } },
    { body: { ...mockEServiceSeed, mode: "invalid" } },
    { body: { ...mockEServiceSeed, technology: "invalid" } },
    { body: { ...mockEServiceSeed, personalData: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, body as bffApi.EServiceSeed);
      expect(res.status).toBe(400);
    }
  );
});
