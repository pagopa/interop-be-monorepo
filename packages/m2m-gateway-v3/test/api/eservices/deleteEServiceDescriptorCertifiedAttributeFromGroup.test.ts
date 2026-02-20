import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEServiceAttribute,
  getMockedApiEserviceDescriptor,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("DELETE /eservices/{eserviceId}/descriptors/{descriptorId}/certifiedAttributes/groups/{groupIndex}/attributes/{attributeId} router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    groupIndex: number,
    attributeId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/certifiedAttributes/groups/${groupIndex}/attributes/${attributeId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const mockApiAttribute = getMockedApiEServiceAttribute();
  const mockApiEServiceDescriptor = getMockedApiEserviceDescriptor({
    attributes: {
      certified: [
        [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
        [mockApiAttribute],
      ],
      declared: [],
      verified: [],
    },
  });
  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiEServiceDescriptor],
  });
  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice);

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteEServiceDescriptorCertifiedAttributeFromGroup =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockM2MEserviceResponse.id,
        mockApiEServiceDescriptor.id,
        1,
        mockApiAttribute.id
      );
      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.deleteEServiceDescriptorCertifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      generateId(),
      0,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    mockEserviceService.deleteEServiceDescriptorCertifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "INVALID ID",
      0,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for group index", async () => {
    mockEserviceService.deleteEServiceDescriptorCertifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      -1,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for attribute id", async () => {
    mockEserviceService.deleteEServiceDescriptorCertifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      "INVALID ID"
    );
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId()
    );
    expect(res.status).toBe(403);
  });
});
