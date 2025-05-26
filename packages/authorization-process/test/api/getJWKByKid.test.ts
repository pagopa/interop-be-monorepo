/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClientJWKKey,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientKeyNotFound } from "../../src/model/domain/errors.js";

describe("API /keys/{keyId} authorization test", () => {
  const mockKey = getMockClientJWKKey();

  authorizationService.getJWKByKid = vi.fn().mockResolvedValue(mockKey);

  const makeRequest = async (token: string, keyId: string) =>
    request(api)
      .get(`/keys/${keyId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockKey.kid);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockKey);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockKey.kid);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientKeyNotFound", async () => {
    authorizationService.getClientKeyById = vi
      .fn()
      .mockRejectedValue(clientKeyNotFound(mockKey.kid, undefined));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockKey.kid);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid uuid", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalidUuid");
    expect(res.status).toBe(400);
  });
});
