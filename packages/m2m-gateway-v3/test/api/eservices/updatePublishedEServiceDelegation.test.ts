import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  randomBoolean,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /eservices/:eserviceId/delegation router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();

  const mockSeed: m2mGatewayApiV3.EServiceDelegationUpdateSeed = {
    isClientAccessDelegable: randomBoolean(),
    isConsumerDelegable: randomBoolean(),
  };

  const mockM2MEService: m2mGatewayApiV3.EService =
    toM2MGatewayApiEService(mockEService);

  const makeRequest = async (
    token: string,
    eserviceId: string = mockEService.id,
    body: m2mGatewayApiV3.EServiceDelegationUpdateSeed = mockSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/eservices/${eserviceId}/delegation`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.updatePublishedEServiceDelegation = vi
        .fn()
        .mockResolvedValue(mockM2MEService);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEService);
      expect(
        mockEserviceService.updatePublishedEServiceDelegation
      ).toHaveBeenCalledWith(
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

  it.each([
    {},
    { isClientAccessDelegable: randomBoolean() },
    { isConsumerDelegable: randomBoolean() },
    {
      isClientAccessDelegable: randomBoolean(),
      isConsumerDelegable: randomBoolean(),
    },
  ] satisfies m2mGatewayApiV3.EServiceDelegationUpdateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidEServiceId");
    expect(res.status).toBe(400);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockSeed, extraParam: -1 },
    { ...mockSeed, isConsumerDelegable: "invalid" },
  ])("Should return 400 if passed invalid seed (seed #%#)", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      seed as m2mGatewayApiV3.EServiceDelegationUpdateSeed
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
    mockEserviceService.updatePublishedEServiceDelegation = vi
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
      mockEserviceService.updatePublishedEServiceDelegation = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
