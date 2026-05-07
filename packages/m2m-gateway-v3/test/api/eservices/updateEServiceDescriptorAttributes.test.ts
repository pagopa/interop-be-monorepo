import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { ApiError, generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("POST /eservices/{eserviceId}/descriptors/{descriptorId}/attributes/update router test", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();
  const attributeId = generateId();

  const mockAttributesSeed: m2mGatewayApiV3.DescriptorAttributesSeed = {
    certified: [
      [
        {
          id: attributeId,
          explicitAttributeVerification: false,
          dailyCallsPerConsumer: 500,
        },
      ],
    ],
    declared: [],
    verified: [],
  };

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.DescriptorAttributesSeed = mockAttributesSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/attributes/update`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and update descriptor attributes for user with role %s",
    async (role) => {
      mockEserviceService.updateEServiceDescriptorAttributes = vi
        .fn()
        .mockResolvedValue(undefined);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(res.headers).toHaveProperty("digest");
      expect(res.headers).toHaveProperty("agid-jwt-signature");
      expect(
        mockEserviceService.updateEServiceDescriptorAttributes
      ).toHaveBeenCalledWith(
        unsafeBrandId(eserviceId),
        unsafeBrandId(descriptorId),
        mockAttributesSeed,
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
    { ...mockAttributesSeed, certified: [[{ id: attributeId }]] },
    {
      ...mockAttributesSeed,
      declared: [[{ id: attributeId, explicitAttributeVerification: false }]],
      extraParam: "notAllowed",
    },
    {
      ...mockAttributesSeed,
      declared: [
        [
          {
            id: attributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 500,
          },
        ],
      ],
    },
  ])("Should return 400 if passed invalid attributes seed %#", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as m2mGatewayApiV3.DescriptorAttributesSeed
    );

    expect(res.status).toBe(400);
  });

  it("Should return 404 in case of eServiceDescriptorNotFound error", async () => {
    mockEserviceService.updateEServiceDescriptorAttributes = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          code: "eServiceDescriptorNotFound",
          title: "E-Service descriptor not found",
          detail: "E-Service descriptor not found",
        })
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(404);
  });

  it("Should return 409 in case of unchangedAttributes error", async () => {
    mockEserviceService.updateEServiceDescriptorAttributes = vi
      .fn()
      .mockRejectedValue(
        new ApiError({
          code: "unchangedAttributes",
          title: "Unchanged attributes",
          detail: "Unchanged attributes",
        })
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(409);
  });
});
