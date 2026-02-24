/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, ClientId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKeyNotFound,
  clientNotFound,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/keys/{keyId} authorization test", () => {
  const clientId = generateId<ClientId>();
  const keyId = generateId();

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    keyId: string
  ) =>
    request(api)
      .delete(`/clients/${clientId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.deleteClientKeyById = vi.fn().mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, clientId, keyId);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, clientId, keyId);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(clientId),
      expectedStatus: 404,
    },
    {
      error: clientKeyNotFound(keyId, clientId),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.deleteClientKeyById = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, clientId, keyId);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{}, { clientId: "invalidId", keyId }])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, keyId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        keyId as string
      );

      expect(res.status).toBe(400);
    }
  );
});
