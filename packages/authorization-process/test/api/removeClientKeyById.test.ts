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

  const makeRequest = async (token: string, clientId: string, keyId: string) =>
    request(api)
      .delete(`/clients/${clientId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
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

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.deleteClientKeyById = vi
      .fn()
      .mockRejectedValue(clientNotFound(clientId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, clientId, keyId);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for clientKeyNotFound", async () => {
    authorizationService.deleteClientKeyById = vi
      .fn()
      .mockRejectedValue(clientKeyNotFound(keyId, clientId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, clientId, keyId);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
