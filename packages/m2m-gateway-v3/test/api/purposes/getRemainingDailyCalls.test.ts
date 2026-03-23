import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { generateId, PurposeId } from "pagopa-interop-models";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /purposes/:purposeId/remainingDailyCalls router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const mockRemainingDailyCalls: m2mGatewayApiV3.RemainingDailyCallsResponse = {
    remainingDailyCallsPerConsumer: 80,
    remainingDailyCallsTotal: 1800,
  };

  const mockPurposeId = generateId<PurposeId>();

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/remainingDailyCalls`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.getRemainingDailyCalls = vi
        .fn()
        .mockResolvedValue(mockRemainingDailyCalls);

      const token = generateToken(role);
      const res = await makeRequest(token, mockPurposeId);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRemainingDailyCalls);
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeService.getRemainingDailyCalls = vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockPurposeId);
    expect(res.status).toBe(403);
  });
});
