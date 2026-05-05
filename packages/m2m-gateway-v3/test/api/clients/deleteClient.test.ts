import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /clients/:clientId router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .delete(`${appBasePath}/clients/${clientId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const clientId = generateId();
      mockClientService.deleteClient = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, clientId);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
      expect(mockClientService.deleteClient).toHaveBeenCalledWith(
        clientId,
        expect.any(Object) // context
      );
    }
  );

  it("Should return 400 for incorrect value for client id", async () => {
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

  it("Should return 500 in case of pollingMaxRetriesExceeded error", async () => {
    mockClientService.deleteClient = vi
      .fn()
      .mockRejectedValue(
        pollingMaxRetriesExceeded(
          config.defaultPollingMaxRetries,
          config.defaultPollingRetryDelay
        )
      );

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId());

    expect(res.status).toBe(500);
  });
});
