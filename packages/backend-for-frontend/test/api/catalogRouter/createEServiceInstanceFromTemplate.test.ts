/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedEServiceDescriptor,
  getMockBffApiInstanceEServiceSeed,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/:templateId/eservices", () => {
  const mockInstanceEServiceSeed = getMockBffApiInstanceEServiceSeed();
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService(
    generateId<EServiceId>(),
    generateId<TenantId>(),
    [mockDescriptor]
  );
  const mockApiCreatedEServiceDescriptor =
    getMockBffApiCreatedEServiceDescriptor(mockEService.id, mockDescriptor.id);

  beforeEach(() => {
    clients.catalogProcessClient.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = generateId(),
    body: bffApi.InstanceEServiceSeed = mockInstanceEServiceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/templates/${templateId}/eservices`)
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
    { templateId: "invalid" as EServiceTemplateId },
    { body: { ...mockInstanceEServiceSeed, extraField: 1 } },
    {
      body: { ...mockInstanceEServiceSeed, isClientAccessDelegable: "invalid" },
    },
    { body: { ...mockInstanceEServiceSeed, isConsumerDelegable: "invalid" } },
    { body: { ...mockInstanceEServiceSeed, isSignalHubEnabled: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ templateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId,
        body as bffApi.InstanceEServiceSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
