/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockApiCreatedResource } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/update", () => {
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockApiUpdateEServiceDescriptorQuotas: catalogApi.UpdateEServiceDescriptorQuotasSeed =
    {
      voucherLifespan: 0,
      dailyCallsPerConsumer: 0,
      dailyCallsTotal: 0,
    };
  const mockApiCreatedResource = getMockApiCreatedResource();

  const makeRequest = async (
    token: string,
    descriptorId: unknown = mockDescriptorId
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${mockEServiceId}/descriptors/${descriptorId}/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockApiUpdateEServiceDescriptorQuotas);

  beforeEach(() => {
    clients.catalogProcessClient.updateDescriptor = vi
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
