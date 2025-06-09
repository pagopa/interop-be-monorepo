import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  PurposeId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingPurposeVersionWithState,
  missingMetadata,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("POST /purposes/:purposeId/approve router test", () => {
  const mockApiPurpose = getMockedApiPurpose();
  const mockM2MPurposeResponse = toM2MGatewayApiPurpose(mockApiPurpose);

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/approve`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.approvePurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeResponse);
    }
  );

  it("Should return 409 for missing waiting for approval purpose version", async () => {
    mockPurposeService.approvePurpose = vi
      .fn()
      .mockRejectedValue(
        missingPurposeVersionWithState(
          generateId<PurposeId>(),
          purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(409);
  });

  it("Should return 400 for invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockPurposeService.approvePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId());

      expect(res.status).toBe(500);
    }
  );

  it.each([
    { ...mockM2MPurposeResponse, createdAt: undefined },
    { ...mockM2MPurposeResponse, eserviceId: "invalidId" },
    { ...mockM2MPurposeResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.approvePurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockM2MPurposeResponse.id);

      expect(res.status).toBe(500);
    }
  );
});
