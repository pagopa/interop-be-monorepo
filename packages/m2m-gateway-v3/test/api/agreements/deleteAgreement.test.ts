import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("DELETE /purpose/:purposeId router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (token: string, agreementId: string) =>
    request(api)
      .delete(`${appBasePath}/agreements/${agreementId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiAgreement = getMockedApiAgreement();
  const mockM2MAgreementResponse = toM2MGatewayApiAgreement(
    mockApiAgreement,
    generateId()
  );

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.deleteAgreementById = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MAgreementResponse.id);

      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.deleteAgreementById = vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });
});
