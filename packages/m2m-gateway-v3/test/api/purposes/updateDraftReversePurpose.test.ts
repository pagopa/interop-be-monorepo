import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /reversePurposes/:purposeId router test", () => {
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockUpdateSeed: m2mGatewayApiV3.ReversePurposeDraftUpdateSeed = {
    title: "updated title",
    description: "updated description",
    dailyCalls: 99,
    isFreeOfCharge: false,
    freeOfChargeReason: null,
  };

  const mockM2MPurpose: m2mGatewayApiV3.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id,
    body: m2mGatewayApiV3.ReversePurposeDraftUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/reversePurposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.updateDraftReversePurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurpose);
      expect(mockPurposeService.updateDraftReversePurpose).toHaveBeenCalledWith(
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
    async (seed: m2mGatewayApiV3.ReversePurposeDraftUpdateSeed) => {
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
      seed as m2mGatewayApiV3.ReversePurposeDraftUpdateSeed
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
    mockPurposeService.updateDraftReversePurpose = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MPurpose, createdAt: undefined },
    { ...mockM2MPurpose, eserviceId: "invalidId" },
    { ...mockM2MPurpose, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.updateDraftReversePurpose = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
