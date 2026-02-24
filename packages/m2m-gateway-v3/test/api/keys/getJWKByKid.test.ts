import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  generateToken,
  getMockClientJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, mockKeyService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MKey } from "../../../src/api/keysApiConverter.js";

describe("GET /keys/{keyId} router test", () => {
  const mockKey = getMockClientJWKKey();
  const { clientId, ...jwk } = mockKey;

  const expectedKey = toM2MKey({ clientId, jwk });

  const makeRequest = async (token: string, keyId: string) =>
    request(api)
      .get(`${appBasePath}/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockKeyService.getKey = vi.fn().mockResolvedValueOnce(expectedKey);

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

  it.each([
    {},
    {
      ...expectedKey,
      clientId: "invalidUuid",
    },
    {
      ...expectedKey,
      invalidParam: "invalidValue",
    },
    {
      ...expectedKey,
      kid: undefined,
    },
    {
      extraParam: "extraValue",
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockKeyService.getKey = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockKey.kid);

      expect(res.status).toBe(500);
    }
  );
});
