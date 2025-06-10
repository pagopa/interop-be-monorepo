/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId, UserId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

type AddUsersToClientBody = { userIds: UserId[] };

describe("API POST /clients/:clientId/users", () => {
  const mockUserIds = {
    userIds: [generateId<UserId>()],
  };

  beforeEach(() => {
    clients.authorizationClient.client.addUsers = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId(),
    body: AddUsersToClientBody = mockUserIds
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(204);
  });

  it.each([
    { clientId: "invalid" as ClientId },
    { body: {} },
    { body: { ...mockUserIds, extraField: 1 } },
    { body: { ...mockUserIds, userIds: "invalid" } },
    { body: { ...mockUserIds, userIds: ["invalid"] } },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ clientId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId,
        body as AddUsersToClientBody
      );
      expect(res.status).toBe(400);
    }
  );
});
