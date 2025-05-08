/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import { getMockApiHasCertifiedAttributes } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("API GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate", () => {
  const mockTenantId = generateId<TenantId>();
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockApiHasCertifiedAttributes = getMockApiHasCertifiedAttributes();

  agreementService.verifyTenantCertifiedAttributes = vi
    .fn()
    .mockResolvedValue(mockApiHasCertifiedAttributes);

  const makeRequest = async (
    token: string,
    descriptorId: string = mockDescriptorId
  ) =>
    request(api)
      .get(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/tenants/${mockTenantId}/eservices/${mockEServiceId}/descriptors/${descriptorId}/certifiedAttributes/validate`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiHasCertifiedAttributes);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
