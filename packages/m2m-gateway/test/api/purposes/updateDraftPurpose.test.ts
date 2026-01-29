import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  invalidSeedForPurposeFromTemplate,
  missingMetadata,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /purposes/:purposeId router test", () => {
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockUpdateSeed: m2mGatewayApi.PurposeDraftUpdateSeed = {
    title: "updated title",
    description: "updated description",
    dailyCalls: 99,
    isFreeOfCharge: false,
    freeOfChargeReason: null,
    riskAnalysisForm: generateMock(m2mGatewayApi.RiskAnalysisFormSeed),
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id,
    body: m2mGatewayApi.PurposeDraftUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.updateDraftPurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurpose);
      expect(mockPurposeService.updateDraftPurpose).toHaveBeenCalledWith(
        mockPurpose.id,
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
    { title: "updated title" },
    { description: "updated description" },
    {
      title: "updated title",
      description: "updated description",
    },
    {
      title: "updated title",
      description: "updated description",
      dailyCalls: 99,
    },

    // With nullable fields
    { freeOfChargeReason: null },
    { title: "updated title", isFreeOfCharge: false, freeOfChargeReason: null },
  ])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed: m2mGatewayApi.PurposeDraftUpdateSeed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurpose.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidPurposeId");
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
      mockPurpose.id,
      seed as m2mGatewayApi.PurposeDraftUpdateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: invalidSeedForPurposeFromTemplate(["invalid"]),
      errorStatus: 400,
    },
    {
      error: missingMetadata(),
      errorStatus: 500,
    },
    {
      error: pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      ),
      errorStatus: 500,
    },
  ])(
    "Should return 500 in case of $error.code error",
    async ({ error, errorStatus }) => {
      mockPurposeService.updateDraftPurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(errorStatus);
    }
  );

  it.each([
    { ...mockM2MPurpose, createdAt: undefined },
    { ...mockM2MPurpose, eserviceId: "invalidId" },
    { ...mockM2MPurpose, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.updateDraftPurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
