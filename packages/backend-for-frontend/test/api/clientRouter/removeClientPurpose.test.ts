/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId, PurposeId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /clients/:clientId/purposes/:purposeId", () => {
  beforeEach(() => {
    clients.authorizationClient.client.removeClientPurpose = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId(),
    purposeId: PurposeId = generateId()
  ) =>
    request(api)
      .delete(`${appBasePath}/clients/${clientId}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(204);
  });

  it.each([
    { clientId: "invalid" as ClientId },
    { purposeId: "invalid" as PurposeId },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ clientId, purposeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId, purposeId);
      expect(res.status).toBe(400);
    }
  );
});
