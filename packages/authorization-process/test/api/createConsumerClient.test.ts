/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { clientKind, generateId, TenantId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { testToFullClient } from "../apiUtils.js";
import { duplicatedMembersInSeed } from "../../src/model/domain/errors.js";

describe("API /clientsConsumer authorization test", () => {
  const organizationId: TenantId = generateId();

  const clientSeed: authorizationApi.ClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [organizationId],
  };

  const mockClient = getMockWithMetadata(
    getMockClient({
      kind: clientKind.consumer,
      consumerId: mockTokenOrganizationId,
    })
  );

  authorizationService.createConsumerClient = vi
    .fn()
    .mockResolvedValue(mockClient);

  const makeRequest = async (
    token: string,
    body: authorizationApi.ClientSeed
  ) =>
    request(api)
      .post(`/clientsConsumer`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, clientSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient.data));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, clientSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...clientSeed, invalidParam: "invalidValue" },
    { ...clientSeed, name: 1 },
    { ...clientSeed, members: [1] },
    { ...clientSeed, name: undefined },
    { ...clientSeed, members: undefined },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as authorizationApi.ClientSeed);

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed duplicated users in body", async () => {
    const userId = generateId();
    const seed = {
      ...clientSeed,
      members: [userId, userId, generateId()],
    };
    authorizationService.createConsumerClient = vi
      .fn()
      .mockImplementation(() => Promise.reject(duplicatedMembersInSeed()));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, seed);

    expect(res.status).toBe(400);
  });
});
