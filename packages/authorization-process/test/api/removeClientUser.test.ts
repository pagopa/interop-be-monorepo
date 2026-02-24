/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Client, UserId, ClientId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientNotFound,
  clientUserIdNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";

describe("API /clients/{clientId}/users/{userId} authorization test", () => {
  const userIdToRemove: UserId = generateId();
  const userIdToNotRemove: UserId = generateId();

  const mockClient: Client = {
    ...getMockClient(),
    users: [userIdToRemove, userIdToNotRemove],
  };

  const serviceResponse = getMockWithMetadata(mockClient);

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    userId: UserId
  ) =>
    request(api)
      .delete(`/clients/${clientId}/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.removeClientUser = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, userIdToRemove);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(authorizationService.removeClientUser).toHaveBeenCalledWith(
        {
          clientId: mockClient.id,
          userIdToRemove,
        },
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, userIdToRemove);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: clientUserIdNotFound(userIdToRemove, mockClient.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.removeClientUser = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id, userIdToRemove);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { clientId: "invalidId", userId: userIdToRemove },
    { clientId: mockClient.id, userId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: $s",
    async ({ clientId, userId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        userId as UserId
      );

      expect(res.status).toBe(400);
    }
  );
});
