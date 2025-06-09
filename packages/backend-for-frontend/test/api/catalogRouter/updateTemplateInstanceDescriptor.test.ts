/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiUpdateEServiceTemplateInstanceDescriptorQuotas,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/eservices/:eServiceId/descriptors/:descriptorId/update", () => {
  const mockUpdateEServiceTemplateInstanceDescriptorQuotas =
    getMockBffApiUpdateEServiceTemplateInstanceDescriptorQuotas();
  const mockEService = getMockCatalogApiEService();
  const mockApiCreatedResource = getMockBffApiCreatedResource(mockEService.id);

  beforeEach(() => {
    clients.catalogProcessClient.updateTemplateInstanceDescriptor = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    descriptorId: DescriptorId = mockEService.descriptors[0].id as DescriptorId,
    body: bffApi.UpdateEServiceTemplateInstanceDescriptorQuotas = mockUpdateEServiceTemplateInstanceDescriptorQuotas
  ) =>
    request(api)
      .post(
        `${appBasePath}/templates/eservices/${eServiceId}/descriptors/${descriptorId}/update`
      )
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
    { descriptorId: "invalid" as DescriptorId },
    { body: {} },
    {
      body: {
        ...mockUpdateEServiceTemplateInstanceDescriptorQuotas,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateInstanceDescriptorQuotas,
        dailyCallsPerConsumer: -1,
      },
    },
    {
      body: {
        ...mockUpdateEServiceTemplateInstanceDescriptorQuotas,
        dailyCallsTotal: -1,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.UpdateEServiceTemplateInstanceDescriptorQuotas
      );
      expect(res.status).toBe(400);
    }
  );
});
