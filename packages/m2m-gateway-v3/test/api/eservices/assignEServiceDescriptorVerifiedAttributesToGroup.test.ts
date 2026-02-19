import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiAttribute,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  catalogApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorAttributeGroupNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";

describe("POST /eservices/{eServiceId}/descriptors/{descriptorId}/verifiedAttributes/groups/{groupIndex}/attributes router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();
  const mockDescriptor = mockEService.descriptors[0]!;

  const mockAttributeSeed: m2mGatewayApiV3.EServiceDescriptorAttributesGroupSeed =
    {
      attributeIds: [generateId(), generateId(), generateId()],
    };

  const mockAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    code: "CODE1",
  });
  const mockAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
    code: "CODE2",
  });

  const mockResponse: m2mGatewayApiV3.EServiceDescriptorVerifiedAttributesGroup =
    {
      attributes: [
        {
          groupIndex: 0,
          attribute: toM2MGatewayApiVerifiedAttribute({
            attribute: mockAttribute1,
            logger: genericLogger,
          }),
        },
        {
          groupIndex: 0,
          attribute: toM2MGatewayApiVerifiedAttribute({
            attribute: mockAttribute2,
            logger: genericLogger,
          }),
        },
      ],
    };

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    groupIndex: number,
    body: m2mGatewayApiV3.EServiceDescriptorAttributesGroupSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/verifiedAttributes/groups/${groupIndex}/attributes`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and assign verified attributes group for user with role %s",
    async (role) => {
      mockEserviceService.assignEServiceDescriptorVerifiedAttributesToGroup = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockEService.id,
        mockDescriptor.id,
        0,
        mockAttributeSeed
      );

      expect(res.status).toBe(204);
      expect(
        mockEserviceService.assignEServiceDescriptorVerifiedAttributesToGroup
      ).toHaveBeenCalledWith(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        0,
        mockAttributeSeed,
        expect.anything()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      0,
      mockAttributeSeed
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed invalid attribute IDs", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const invalidBody = { attributeIds: ["not-a-uuid", "also-invalid"] };
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      0,
      invalidBody
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      mockDescriptor.id,
      0,
      mockAttributeSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      "INVALID ID",
      0,
      mockAttributeSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for group index", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      -1,
      mockAttributeSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if body is not an array", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await request(api)
      .post(
        `${appBasePath}/eservices/${mockEService.id}/descriptors/${mockDescriptor.id}/verifiedAttributes/groups/0/attributes`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send({ invalid: "body" });

    expect(res.status).toBe(400);
  });

  it("Should return 404 if descriptor not found", async () => {
    const nonExistentDescriptorId = generateId();
    mockEserviceService.assignEServiceDescriptorVerifiedAttributesToGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(
          unsafeBrandId(mockEService.id),
          unsafeBrandId(nonExistentDescriptorId)
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      nonExistentDescriptorId,
      0,
      mockAttributeSeed
    );

    expect(res.status).toBe(404);
  });
  it("Should return 404 if group not found", async () => {
    const nonExistentGroupId = 1;
    mockEserviceService.assignEServiceDescriptorVerifiedAttributesToGroup = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorAttributeGroupNotFound(
          "verified",
          unsafeBrandId(mockEService.id),
          unsafeBrandId(mockDescriptor.id),
          nonExistentGroupId
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      mockDescriptor.id,
      nonExistentGroupId,
      mockAttributeSeed
    );

    expect(res.status).toBe(404);
  });
});
