import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";

describe("GET /eservices/:eserviceId/descriptors/:descriptorId router test", () => {
  const mockApiEserviceDescriptor = getMockedApiEserviceDescriptor();
  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiEserviceDescriptor],
  });
  const mockM2MEserviceDescriptorResponse: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiEserviceDescriptor);

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceDescriptor = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceDescriptorResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiEserviceDescriptor.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDescriptorResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockApiEservice.id,
      mockApiEserviceDescriptor.id
    );
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalidId",
      mockApiEserviceDescriptor.id
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiEservice.id, "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MEserviceDescriptorResponse, id: undefined },
    { ...mockM2MEserviceDescriptorResponse, invalidParam: "invalidValue" },
    { ...mockM2MEserviceDescriptorResponse, state: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEServiceDescriptor = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiEserviceDescriptor.id
      );

      expect(res.status).toBe(500);
    }
  );

  it("Should return 404 in case of eserviceDescriptorNotFound error", async () => {
    mockEserviceService.getEServiceDescriptor = vi
      .fn()
      .mockRejectedValue(
        eserviceDescriptorNotFound(
          mockApiEservice.id,
          mockApiEserviceDescriptor.id
        )
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockApiEservice.id,
      mockApiEserviceDescriptor.id
    );

    expect(res.status).toBe(404);
  });
});
