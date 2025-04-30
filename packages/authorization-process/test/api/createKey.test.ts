/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Client, generateId, TenantId, UserId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { keyToApiKey } from "../../src/model/domain/apiConverter.js";

describe("API /clients/{clientId}/keys authorization test", () => {
  const consumerId: TenantId = generateId();
  const userId: UserId = generateId();

  const keySeed: authorizationApi.KeySeed = {
    name: "key seed",
    use: "ENC",
    key: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFakePem`,
    alg: "",
  };

  const mockClient: Client = {
    ...getMockClient(),
    users: [userId],
    consumerId,
  };

  const key = getMockKey();

  const apiKey = keyToApiKey(key);

  authorizationService.createKey = vi.fn().mockResolvedValue(key);

  const makeRequest = async (token: string, clientId: string) =>
    request(api)
      .post(`/clients/${clientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(keySeed);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);
    expect(res.status).toBe(403);
  });
});
