import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/scheduleArchive router test", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor =
    getMockedApiEserviceDescriptor();

  const mockApiEservice: catalogApi.EService = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockM2MEServiceDescriptor: m2mGatewayApiV3.EServiceDescriptor =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const mockSeed: m2mGatewayApiV3.GracePeriodDaysSeed = {
    gracePeriodDays: 60,
  };

  const makeRequest = async (
    token: string,
    eserviceId: string = mockApiEservice.id,
    descriptorId: string = mockApiDescriptor.id,
    body: m2mGatewayApiV3.GracePeriodDaysSeed = mockSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/scheduleArchive`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.scheduleArchiveEserviceDescriptor = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceDescriptor);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(
        mockEserviceService.scheduleArchiveEserviceDescriptor
      ).toHaveBeenCalledWith(
        mockApiEservice.id,
        mockApiDescriptor.id,
        expect.any(Object) // context
      );
      expect(res.status).toBe(200);
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

  it.each([-1, 0, 1, 29])(
    "Should return 400 for invalid gracePeriodDays %s",
    async (gracePeriodDays) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockApiEservice.id,
        mockApiDescriptor.id,
        { gracePeriodDays: gracePeriodDays as m2mGatewayApiV3.GracePeriodDays }
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
    mockEserviceService.scheduleArchiveEserviceDescriptor = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockApiDescriptor, createdAt: undefined },
    { ...mockApiDescriptor, id: "invalidId" },
    { ...mockApiDescriptor, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEserviceService.scheduleArchiveEserviceDescriptor = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
