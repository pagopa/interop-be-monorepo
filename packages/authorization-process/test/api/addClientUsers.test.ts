/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  Client,
  ClientId,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  generateToken,
  getMockClient,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientNotFound,
  clientUserAlreadyAssigned,
  tenantNotAllowedOnClient,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/users authorization test", () => {
  const consumerId: TenantId = generateId();
  const userIds: UserId[] = [generateId()];
  const usersToAdd: UserId[] = [generateId(), generateId()];

  const mockClient: Client = getMockClient({
    consumerId,
    users: userIds,
  });

  authorizationService.addClientUsers = vi.fn().mockResolvedValue(mockClient);

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    userIds: UserId[] = usersToAdd
  ) =>
    request(api)
      .post(`/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ userIds });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 with a compact client for user with role %s and tenant != client consumerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: mockClient.id,
        consumerId: mockClient.consumerId,
        kind: mockClient.kind.toUpperCase(),
      });
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s and tenant = client consumerId",
    async (role) => {
      const mockClient = getMockClient({
        consumerId: mockTokenOrganizationId,
      });
      authorizationService.addClientUsers = vi
        .fn()
        .mockResolvedValueOnce(mockClient);
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: mockClient.id,
        name: mockClient.name,
        consumerId: mockClient.consumerId,
        users: mockClient.users,
        createdAt: mockClient.createdAt.toJSON(),
        purposes: mockClient.purposes,
        kind: mockClient.kind.toUpperCase(),
        description: mockClient.description,
        adminId: mockClient.adminId,
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: userWithoutSecurityPrivileges(generateId(), usersToAdd[0]),
      expectedStatus: 403,
    },
    {
      error: clientUserAlreadyAssigned(mockClient.id, userIds[0]),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addClientUsers = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { clientId: "invalidId", userIds: usersToAdd },
    { clientId: mockClient.id, userIds: ["invalidId"] },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, userIds }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        userIds as UserId[]
      );

      expect(res.status).toBe(400);
    }
  );
});
