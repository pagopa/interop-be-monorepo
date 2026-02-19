import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiAgreement,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { generateId, PurposeId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { purposeAgreementNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("GET /purposes/:purposeId/agreement router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockM2MAgreement = toM2MGatewayApiAgreement(
    getMockedApiAgreement(),
    generateId()
  );

  const mockPurposeId: PurposeId = generateId();

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/agreement`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposeAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreement);

      const token = generateToken(role);
      const res = await makeRequest(token, mockPurposeId);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreement);
      expect(mockPurposeService.getPurposeAgreement).toHaveBeenCalledWith(
        mockPurposeId,
        expect.any(Object)
      );
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeService.getPurposeAgreement = vi.fn();

    const token = generateToken(authRole.M2M_ROLE);
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

  it("Should return 404 in case of purposeAgreementNotFound error", async () => {
    mockPurposeService.getPurposeAgreement = vi
      .fn()
      .mockRejectedValue(purposeAgreementNotFound(mockPurposeId));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, mockPurposeId);
    expect(res.status).toBe(404);
  });
});
