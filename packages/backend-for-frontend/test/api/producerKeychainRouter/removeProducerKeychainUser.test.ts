/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { UserId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /producerKeychains/{producerKeychainId}/users/{userId} test", () => {
  beforeEach(() => {
    clients.authorizationClient.producerKeychain.removeProducerKeychainUser = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId(),
    userId: UserId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/producerKeychains/${producerKeychainId}/users/${userId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([{ producerKeychainId: "invalid" }, { userId: "invalid" as UserId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ producerKeychainId, userId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, producerKeychainId, userId);
      expect(res.status).toBe(400);
    }
  );
});
