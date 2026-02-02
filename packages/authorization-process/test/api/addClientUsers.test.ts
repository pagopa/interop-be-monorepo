/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Client, ClientId, generateId, UserId } from "pagopa-interop-models";
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
  missingSelfcareId,
  tenantNotAllowedOnClient,
  tenantNotFound,
  userWithoutSecurityPrivileges,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";

describe("API /clients/{clientId}/users authorization test", () => {
  const userIds: UserId[] = [generateId()];
  const usersToAdd: UserId[] = [generateId(), generateId()];

  const mockClient: Client = getMockClient({
    consumerId: mockTokenOrganizationId,
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

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });

  const errors = [
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
    {
      error: tenantNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: missingSelfcareId(generateId()),
      expectedStatus: 404,
    },
  ];

  const errorScenarios = authorizedRoles.flatMap((role) =>
    errors.map((params) => ({ role, ...params }))
  );

  it.each(errorScenarios)(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.addClientUsers = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(expectedStatus);
    }
  );

  const invalidParams = [
    {},
    { clientId: "invalidId", userIds: usersToAdd },
    { clientId: mockClient.id, userIds: ["invalidId"] },
  ];

  const testScenarios = authorizedRoles.flatMap((role) =>
    invalidParams.map((params) => ({ role, ...params }))
  );

  it.each(testScenarios)(
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
