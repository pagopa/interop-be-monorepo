import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";

describe("POST /eservices/:eserviceId/scheduleArchive router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();

  const mockSeed: m2mGatewayApiV3.EServiceArchivingReasonSeed = {
    archivingReason: "test reason",
  };

  const mockM2MEService: m2mGatewayApiV3.EService =
    toM2MGatewayApiEService(mockEService);

  const makeRequest = async (
    token: string,
    eserviceId: string = mockEService.id,
    body: m2mGatewayApiV3.EServiceArchivingReasonSeed = mockSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eserviceId}/scheduleArchive`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.scheduleArchiveEService = vi
        .fn()
        .mockResolvedValue(mockM2MEService);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEService);
      expect(mockEserviceService.scheduleArchiveEService).toHaveBeenCalledWith(
        mockEService.id,
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

  it.each([{ invalidParam: "invalidValue" }, { ...mockSeed, extraParam: -1 }])(
    "Should return 400 if passed invalid seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEService.id,
        seed as m2mGatewayApiV3.EServiceArchivingReasonSeed
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
    mockEserviceService.scheduleArchiveEService = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEService, createdAt: undefined },
    { ...mockM2MEService, id: "invalidId" },
    { ...mockM2MEService, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEserviceService.scheduleArchiveEService = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
