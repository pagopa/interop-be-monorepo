import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("DELETE /eservices/{eserviceId} router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (token: string, eserviceId: string) =>
    request(api)
      .delete(`${appBasePath}/eservices/${eserviceId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const mockApiEservice = getMockedApiEservice();
  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice);

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.deleteEService = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, mockM2MEserviceResponse.id);
      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.deleteEService = vi.fn();

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
