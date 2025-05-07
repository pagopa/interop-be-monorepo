/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKeyNotFound,
  clientNotFound,
  organizationNotAllowedOnClient,
  securityUserNotMember,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/keys/{keyId} authorization test", () => {
  const mockKey1 = getMockKey();
  const mockKey2 = getMockKey();
  const mockClient: Client = {
    ...getMockClient(),
    consumerId: generateId(),
    keys: [mockKey1, mockKey2],
  };

  const apiKey = keyToApiKey(mockKey1);

  authorizationService.getClientKeyById = vi.fn().mockResolvedValue(mockKey1);

  const makeRequest = async (token: string, clientId: string, keyId: string) =>
    request(api)
      .get(`/clients/${clientId}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit: 50,
      });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, mockKey1.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, mockKey1.kid);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientKeyNotFound", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(clientKeyNotFound(mockKey1.kid, mockClient.id));

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId(),
      mockKey1.kid
    );

    expect(res.status).toBe(404);
  });

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockClient.id));

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId(),
      mockKey1.kid
    );

    expect(res.status).toBe(404);
  });

  it("Should return 404 for clientKeyNotFound", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(clientKeyNotFound(mockKey1.kid, mockClient.id));

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId(),
      mockKey1.kid
    );

    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, mockKey1.kid);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for securityUserNotMember", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(securityUserNotMember(mockClient.users[0]));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, mockKey1.kid);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
