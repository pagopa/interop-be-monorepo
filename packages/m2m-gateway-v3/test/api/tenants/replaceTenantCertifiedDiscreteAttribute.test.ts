import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiCertifiedDiscreteTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  generateId,
  pollingMaxRetriesExceeded,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { toM2MGatewayApiTenantCertifiedDiscreteAttribute } from "../../../src/api/tenantApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockTenantService } from "../../vitest.api.setup.js";

describe("PUT /tenants/:tenantId/certifiedDiscreteAttributes/:attributeId router test", () => {
  const mockApiResponse = getMockedApiCertifiedDiscreteTenantAttribute();
  const mockTenantId = generateId<TenantId>();
  const mockAttributeId = generateId<AttributeId>();

  const mockUpdateSeed: m2mGatewayApiV3.UpdateTenantCertifiedDiscreteAttributeSeed =
    {
      certifiedDiscreteValue:
        mockApiResponse.discreteValue === 17520 ? 17521 : 17520,
    };

  const mockM2MEUpdateSeed = toM2MGatewayApiTenantCertifiedDiscreteAttribute({
    ...mockApiResponse,
    discreteValue: mockUpdateSeed.certifiedDiscreteValue,
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = mockTenantId,
    attributeId: AttributeId = mockAttributeId,
    body: m2mGatewayApiV3.UpdateTenantCertifiedDiscreteAttributeSeed = mockUpdateSeed
  ) =>
    request(api)
      .put(
        `${appBasePath}/tenants/${tenantId}/certifiedDiscreteAttributes/${attributeId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.replaceTenantCertifiedDiscreteAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MEUpdateSeed);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEUpdateSeed);
      expect(
        mockTenantService.replaceTenantCertifiedDiscreteAttribute
      ).toHaveBeenCalledWith(
        mockTenantId,
        mockAttributeId,
        mockUpdateSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid_id" as TenantId);

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockUpdateSeed, certifiedDiscreteValue: undefined },
    { ...mockUpdateSeed, certifiedDiscreteValue: -1 },
  ])("Should return 400 if passed invalid seed %s", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockTenantId,
      mockAttributeId,
      seed as m2mGatewayApiV3.TenantCertifiedDiscreteAttributeSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockTenantService.replaceTenantCertifiedDiscreteAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    {},
    { ...mockUpdateSeed, version: -1 },
    {
      ...mockUpdateSeed,
      answers: {
        answers: {
          invalidAnswer: {},
        },
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockTenantService.replaceTenantCertifiedDiscreteAttribute = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
