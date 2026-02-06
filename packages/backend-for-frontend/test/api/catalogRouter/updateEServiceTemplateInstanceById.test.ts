/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiUpdateEServiceTemplateInstanceSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/eservices/:eServiceId", () => {
  const mockUpdateEServiceDescriptorTemplateInstanceSeed =
    getMockBffApiUpdateEServiceTemplateInstanceSeed();
  const mockEService = getMockCatalogApiEService();
  const mockApiCreatedResource = getMockBffApiCreatedResource(mockEService.id);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceTemplateInstanceById = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    body: bffApi.UpdateEServiceTemplateInstanceSeed = mockUpdateEServiceDescriptorTemplateInstanceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/templates/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    {
      body: {
        ...mockUpdateEServiceDescriptorTemplateInstanceSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorTemplateInstanceSeed,
        isSignalHubEnabled: "invalid",
      },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorTemplateInstanceSeed,
        isClientAccessDelegable: "invalid",
      },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorTemplateInstanceSeed,
        isConsumerDelegable: "invalid",
      },
    },
    {
      body: {
        ...mockUpdateEServiceDescriptorTemplateInstanceSeed,
        isConsumerDelegable: false,
        isClientAccessDelegable: true,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.UpdateEServiceTemplateInstanceSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
