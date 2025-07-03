/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId, UserId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { createClientApiClient } from "../../../../api-clients/dist/generated/authorizationApi.js";

describe("API DELETE /clients/:clientId/users/:userId", () => {
  const mockClientId = generateId<ClientId>();
  const mockUserId = generateId<UserId>();

  const makeRequest = async (
    token: string,
    clientId: ClientId = mockClientId,
    userId: UserId = mockUserId
  ) =>
    request(api)
      .delete(`${appBasePath}/clients/${clientId}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    clients.authorizationClient.client = {} as ReturnType<
      typeof createClientApiClient
    >;
    clients.authorizationClient.client.removeUser = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(204);
  });

  it.each([
    { clientId: "invalid" as ClientId },
    { userId: "invalid" as UserId },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ clientId, userId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId, userId);
      expect(res.status).toBe(400);
    }
  );
});
