/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EServiceId,
  generateId,
  ProducerKeychain,
  TenantId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { producerKeychainToApiProducerKeychain } from "../../src/model/domain/apiConverter.js";

describe("API /producerKeychains authorization test", () => {
  const producerId: TenantId = generateId();
  const eserviceId: EServiceId = generateId();
  const mockProducerKeychain1: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test1",
    eservices: [eserviceId],
    producerId,
  };
  const mockProducerKeychain2: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "test2",
    eservices: [eserviceId],
    producerId,
  };

  const producerKeychainsResponse = {
    results: [mockProducerKeychain1, mockProducerKeychain2],
    totalCount: 2,
  };

  const apiProducerKeychains = authorizationApi.ProducerKeychains.parse({
    results: producerKeychainsResponse.results.map((producerKeychain) =>
      producerKeychainToApiProducerKeychain(producerKeychain, {
        showUsers: false,
      })
    ),
    totalCount: producerKeychainsResponse.totalCount,
  });

  authorizationService.getProducerKeychains = vi
    .fn()
    .mockResolvedValue(producerKeychainsResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get(`/producerKeychains`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        producerId,
        eserviceId,
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
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiProducerKeychains);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid query parameter (invalid limit)", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .get("/producerKeychains")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        producerId,
        eserviceId,
        offset: 0,
        limit: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("title", "Bad request");
  });
});
