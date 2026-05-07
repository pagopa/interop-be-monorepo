import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { ApiError, generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("POST /templates/eservices/{eserviceId}/descriptors/{descriptorId}/update router test", () => {
  const mockEService = getMockedApiEservice();
  const mockDescriptor = mockEService.descriptors[0]!;
  const mockAttributeId = generateId();

  const mockSeed: m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed =
    {
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: mockAttributeId,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

  const mockResponse: m2mGatewayApiV3.CreatedResource = {
    id: mockEService.id,
  };

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed = mockSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/templates/eservices/${mockEService.id}/descriptors/${mockDescriptor.id}/update`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and update template instance descriptor for user with role %s",
    async (role) => {
      mockEserviceService.updateEServiceTemplateInstanceDescriptor = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
      expect(
        mockEserviceService.updateEServiceTemplateInstanceDescriptor
      ).toHaveBeenCalledWith(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        expect.anything()
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

  it.each([
    {},
    { ...mockSeed, dailyCallsTotal: 0 },
    { ...mockSeed, attributes: { certified: [], declared: [] } },
    { ...mockSeed, attributes: { ...mockSeed.attributes, extraParam: true } },
  ])(
    "Should return 400 if passed invalid template instance seed %#",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        body as m2mGatewayApiV3.UpdateEServiceTemplateInstanceDescriptorQuotasSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it("Should return 403 in case of eServiceNotAnInstance error", async () => {
    mockEserviceService.updateEServiceTemplateInstanceDescriptor = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          code: "eServiceNotAnInstance",
          title: "E-Service is not an instance",
          detail: "E-Service is not an instance",
        })
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });
});
