import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClientJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, mockKeysService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API /keys/{keyId} authorization test", () => {
  const mockKey = getMockClientJWKKey();
  const expectedKey: authorizationApi.ClientJWK = {
    clientId: mockKey.clientId,
    jwk: {
      kid: mockKey.kid,
      kty: mockKey.kty,
      use: mockKey.use,
      alg: mockKey.alg,
      e: mockKey.e,
      n: mockKey.n,
    },
  };

  const makeRequest = async (token: string, keyId: string) =>
    request(api)
      .get(`${appBasePath}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockKeysService.getKey = vi.fn().mockResolvedValueOnce(expectedKey);

      const token = generateToken(role);
      const res = await makeRequest(token, mockKey.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expectedKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockKey.kid);

    expect(res.status).toBe(403);
  });
});
