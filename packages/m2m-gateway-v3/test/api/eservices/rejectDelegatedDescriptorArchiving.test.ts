import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/rejectDelegatedArchiving router test", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor =
    getMockedApiEserviceDescriptor();

  const mockApiEservice: catalogApi.EService = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEServiceDescriptor: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const mockSeed: m2mGatewayApiV3.RejectDelegatedDescriptorArchivingSeed = {
    rejectionReason: "Not needed",
  };

  const makeRequest = async (
    token: string,
    eserviceId: string = mockApiEservice.id,
    descriptorId: string = mockApiDescriptor.id,
    body: m2mGatewayApiV3.RejectDelegatedDescriptorArchivingSeed = mockSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/rejectDelegatedArchiving`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.rejectDelegatedDescriptorArchiving = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceDescriptor);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServiceDescriptor);
      expect(
        mockEserviceService.rejectDelegatedDescriptorArchiving
      ).toHaveBeenCalledWith(
        mockApiEservice.id,
        mockApiDescriptor.id,
        mockSeed,
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

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidEServiceId");
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiEservice.id, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each([{}, { rejectionReason: "" }, { rejectionReason: 1 }])(
    "Should return 400 for invalid body (body #%#)",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiDescriptor.id,
        body as m2mGatewayApiV3.RejectDelegatedDescriptorArchivingSeed
      );
      expect(res.status).toBe(400);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.rejectDelegatedDescriptorArchiving = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEServiceDescriptor, createdAt: undefined },
    { ...mockM2MEServiceDescriptor, id: "invalidId" },
    { ...mockM2MEServiceDescriptor, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEserviceService.rejectDelegatedDescriptorArchiving = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
