import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("DELETE /purpose/:purposeId router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (token: string, purposeId: string) =>
    request(api)
      .delete(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const mockApiPurpose = getMockedApiPurpose();
  const mockM2MPurposeResponse = toM2MGatewayApiPurpose(mockApiPurpose);

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.deletePurpose = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MPurposeResponse.id);

      expect(res.status).toBe(204);
      expect(mockPurposeService.deletePurpose).toHaveBeenCalledWith(
        mockM2MPurposeResponse.id
      );
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeService.deletePurpose = vi.fn();

    const token = generateToken(authRole.M2M_ROLE);
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
