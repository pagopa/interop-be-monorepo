import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
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

describe("PATCH /eservices/:eserviceId router test", () => {
  const mockEService: catalogApi.EService = getMockedApiEservice();

  const mockUpdateSeed: m2mGatewayApiV3.EServiceDraftUpdateSeed = {
    name: "updated name",
    description: "updated description",
    technology: "REST",
    isSignalHubEnabled: true,
    isConsumerDelegable: false,
    isClientAccessDelegable: true,
    mode: "RECEIVE",
  };

  const mockM2MEService: m2mGatewayApiV3.EService =
    toM2MGatewayApiEService(mockEService);

  const makeRequest = async (
    token: string,
    eserviceId: string = mockEService.id,
    body: m2mGatewayApiV3.EServiceDraftUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/eservices/${eserviceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.updateDraftEService = vi
        .fn()
        .mockResolvedValue(mockM2MEService);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEService);
      expect(mockEserviceService.updateDraftEService).toHaveBeenCalledWith(
        mockEService.id,
        mockUpdateSeed,
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
    { name: "updated name" },
    { name: "updated name", description: "updated description" },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      isConsumerDelegable: false,
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      isConsumerDelegable: false,
      isClientAccessDelegable: true,
      mode: "RECEIVE",
    },
    {
      name: "updated name",
      description: "updated description",
      technology: "REST",
      isSignalHubEnabled: true,
      isConsumerDelegable: false,
      isClientAccessDelegable: true,
      mode: "RECEIVE",
      personalData: true,
    },
  ] satisfies m2mGatewayApiV3.EServiceDraftUpdateSeed[])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
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
    { ...mockUpdateSeed, extraParam: -1 },
    { ...mockUpdateSeed, description: "short" },
  ])("Should return 400 if passed invalid seed", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEService.id,
      seed as m2mGatewayApiV3.EServiceDraftUpdateSeed
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
    mockEserviceService.updateDraftEService = vi.fn().mockRejectedValue(error);
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
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.updateDraftEService = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
