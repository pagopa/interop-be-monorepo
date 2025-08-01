/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId, ProducerKeychain, TenantId } from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { testToFullProducerKeychain } from "../apiUtils.js";

describe("API /producerKeychains authorization test", () => {
  const organizationId: TenantId = generateId();

  const producerKeychainSeed: authorizationApi.ProducerKeychainSeed = {
    name: "Seed name",
    description: "Description",
    members: [organizationId],
  };

  const mockProducerKeychain: ProducerKeychain = getMockProducerKeychain();

  authorizationService.createProducerKeychain = vi
    .fn()
    .mockResolvedValue(mockProducerKeychain);

  const makeRequest = async (
    token: string,
    body: authorizationApi.ProducerKeychainSeed
  ) =>
    request(api)
      .post(`/producerKeychains`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        testToFullProducerKeychain(mockProducerKeychain)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, producerKeychainSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...producerKeychainSeed, invalidParam: "invalidValue" },
    { ...producerKeychainSeed, name: 1 },
    { ...producerKeychainSeed, members: [1] },
    { ...producerKeychainSeed, name: undefined },
    { ...producerKeychainSeed, members: undefined },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as authorizationApi.ProducerKeychainSeed
    );

    expect(res.status).toBe(400);
  });
});
