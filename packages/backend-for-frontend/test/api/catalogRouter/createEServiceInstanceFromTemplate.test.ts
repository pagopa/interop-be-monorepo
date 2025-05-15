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
import { api, clients } from "../../vitest.api.setup.js";
import { getMockApiCreatedEServiceDescriptor } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/:templateId/eservices", () => {
  const mockTemplateId = generateId<EServiceTemplateId>();
  const mockInstanceEServiceSeed = {
    isSignalHubEnabled: true,
    isConsumerDelegable: true,
    isClientAccessDelegable: true,
  };
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService(
    generateId<EServiceId>(),
    generateId<TenantId>(),
    [mockDescriptor]
  );
  const mockApiCreatedEServiceDescriptor = getMockApiCreatedEServiceDescriptor(
    mockEService.id,
    mockDescriptor.id
  );

  const makeRequest = async (
    token: string,
    templateId: unknown = mockTemplateId
  ) =>
    request(api)
      .post(`${appBasePath}/templates/${templateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockInstanceEServiceSeed);

  beforeEach(() => {
    clients.catalogProcessClient.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedEServiceDescriptor);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
