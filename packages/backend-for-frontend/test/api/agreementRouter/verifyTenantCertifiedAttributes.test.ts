/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockBffApiHasCertifiedAttributes } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /tenants/:tenantId/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes/validate", () => {
  const mockApiHasCertifiedAttributes = getMockBffApiHasCertifiedAttributes();

  beforeEach(() => {
    clients.agreementProcessClient.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockResolvedValue(mockApiHasCertifiedAttributes);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/tenants/${tenantId}/eservices/${eServiceId}/descriptors/${descriptorId}/certifiedAttributes/validate`
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

  it.each([
    { tenantId: "invalid" as TenantId },
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ tenantId, eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, eServiceId, descriptorId);
      expect(res.status).toBe(400);
    }
  );
});
