import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /eservices/:eserviceId/descriptors/:descriptorId/scheduleArchive router test", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "ARCHIVING",
  };

  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEserviceDescriptorResponse: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const makeRequest = async (
    token: string,
    eserviceId: string = mockApiEservice.id,
    descriptorId: string = mockApiDescriptor.id
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/scheduleArchive`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.cancelEServiceDescriptorArchiving = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceDescriptorResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDescriptorResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID", mockApiDescriptor.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiEservice.id, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.cancelEServiceDescriptorArchiving = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEserviceDescriptorResponse, createdAt: undefined },
    { ...mockM2MEserviceDescriptorResponse, id: "invalidId" },
    { ...mockM2MEserviceDescriptorResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEserviceService.cancelEServiceDescriptorArchiving = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
