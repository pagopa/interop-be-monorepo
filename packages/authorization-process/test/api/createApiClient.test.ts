/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId, UserId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";

describe("API /clientsApi authorization test", () => {
  const userId: UserId = generateId();

  const clientSeed: authorizationApi.ClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [userId],
  };

  const mockClient = getMockClient();

  const apiClient = clientToApiClient(mockClient, { showUsers: true });

  authorizationService.createApiClient = vi
    .fn()
    .mockResolvedValue({ client: mockClient, showUsers: true });

  const makeRequest = async (
    token: string,
    body: authorizationApi.ClientSeed
  ) =>
    request(api)
      .post(`/clientsApi`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, clientSeed);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiClient);
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
});
