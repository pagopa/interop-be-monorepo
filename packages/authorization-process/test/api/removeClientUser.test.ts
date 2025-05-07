/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Client, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientNotFound,
  clientUserIdNotFound,
  organizationNotAllowedOnClient,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/users/{userId} authorization test", () => {
  const userIdToRemove: UserId = generateId();
  const userIdToNotRemove: UserId = generateId();

  const mockClient: Client = {
    ...getMockClient(),
    users: [userIdToRemove, userIdToNotRemove],
  };

  const makeRequest = async (token: string, clientId: string, userId: string) =>
    request(api)
      .delete(`/clients/${clientId}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  authorizationService.removeClientUser = vi.fn().mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, userIdToRemove);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, userIdToRemove);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.removeClientUser = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, userIdToRemove);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for clientUserIdNotFound", async () => {
    authorizationService.removeClientUser = vi
      .fn()
      .mockRejectedValue(clientUserIdNotFound(userIdToRemove, mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, userIdToRemove);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.removeClientUser = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, userIdToRemove);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
