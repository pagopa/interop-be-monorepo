/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { userNotFound } from "../../../src/model/errors.js";
import { getMockBffApiCompactUser } from "../../mockUtils.js";

describe("API GET /producerKeychains/{producerKeychainId}/users test", () => {
  const mockUsers: bffApi.CompactUsers = [
    getMockBffApiCompactUser(),
    getMockBffApiCompactUser(),
  ];

  beforeEach(() => {
    services.producerKeychainService.getProducerKeychainUsers = vi
      .fn()
      .mockResolvedValue(mockUsers);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains/${producerKeychainId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUsers);
  });

  it.each([
    { error: userNotFound(generateId(), generateId()), expectedStatus: 404 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.producerKeychainService.getProducerKeychainUsers = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid producer keychain id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
