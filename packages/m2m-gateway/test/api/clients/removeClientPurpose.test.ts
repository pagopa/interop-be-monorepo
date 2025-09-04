import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /clients/:clientId/purposes/:purposeId router test", () => {
  const makeRequest = async (
    token: string,
    clientId: string,
    purposeId: string
  ) =>
    request(api)
      .delete(`${appBasePath}/clients/${clientId}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      const purposeIdToRemove = generateId();
      const clientId = generateId();
      mockClientService.removeClientPurpose = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, clientId, purposeIdToRemove);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect(mockClientService.removeClientPurpose).toHaveBeenCalledWith(
        clientId,
        purposeIdToRemove,
        expect.any(Object) // Context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-client-id", generateId());

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "invalid-purpose-id");

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockClientService.removeClientPurpose = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(500);
  });
});
