/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  ProducerKeychain,
  generateId,
  TenantId,
  UserId,
  EServiceId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  testToPartialProducerKeychain,
  testToFullProducerKeychain,
} from "../apiUtils.js";

describe("API /producerKeychains authorization test", () => {
  const producerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const userId1: UserId = generateId();
  const userId2: UserId = generateId();

  const producerKeychain1: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "producerKeychain",
    producerId: mockTokenOrganizationId,
    eservices: [eserviceId],
    users: [userId1],
  };

  const producerKeychain2: ProducerKeychain = {
    ...getMockProducerKeychain(),
    name: "producerKeychain",
    producerId,
    eservices: [eserviceId],
    users: [userId2],
  };

  const producerKeychainsResponse = {
    results: [producerKeychain1, producerKeychain2],
    totalCount: 2,
  };

  authorizationService.getProducerKeychains = vi
    .fn()
    .mockResolvedValue(producerKeychainsResponse);

  const queryParams: authorizationApi.GetProducerKeychainsQueryParams = {
    name: "producerKeychain",
    userIds: [userId1, userId2],
    eserviceId,
    producerId,
    offset: 0,
    limit: 50,
  };

  const makeRequest = async (
    token: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/producerKeychains`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with role %s and return full or partial producerKeychains based on producerKeychain producerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        results: [
          testToFullProducerKeychain(producerKeychain1),
          testToPartialProducerKeychain(producerKeychain2),
        ],
        totalCount: 2,
      });
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...queryParams, offset: "invalid" },
    { ...queryParams, limit: "invalid" },
    { ...queryParams, eserviceId: "invalid-eservice-id" },
    { ...queryParams, producerId: "invalid-producer-id" },
    { ...queryParams, offset: -2 },
    { ...queryParams, limit: 100 },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof queryParams);

    expect(res.status).toBe(400);
  });
});
