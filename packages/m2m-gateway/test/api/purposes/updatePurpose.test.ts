import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("PATCH /purposes/:purposeId router test", () => {
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockPurposeUpdateSeed: m2mGatewayApi.PurposeUpdateSeed = {
    dailyCalls: mockPurpose.versions[0].dailyCalls,
    description: mockPurpose.description,
    isFreeOfCharge: mockPurpose.isFreeOfCharge,
    freeOfChargeReason: mockPurpose.freeOfChargeReason,
    title: mockPurpose.title,
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (
    token: string,
    purposeId: string,
    body: m2mGatewayApi.PurposeUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.updatePurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        mockPurposeUpdateSeed
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurpose);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockPurpose.id, mockPurposeUpdateSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeUpdateContent, extraParam: -1 },
    { ...mockPurposeUpdateContent, description: "short" },
  ])(
    "Should return 400 if passed invalid purpose update seed",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        body as m2mGatewayApi.PurposeUpdateSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockPurposeService.updatePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        mockPurposeUpdateSeed
      );

      expect(res.status).toBe(500);
    }
  );

  it.each([
    { ...mockM2MPurpose, createdAt: undefined },
    { ...mockM2MPurpose, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.updatePurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockPurpose.id,
        mockPurposeUpdateSeed
      );

      expect(res.status).toBe(500);
    }
  );
});
