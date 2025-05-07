/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId, TenantId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi } from "pagopa-interop-api-clients";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientToApiClient } from "../../src/model/domain/apiConverter.js";

describe("API /clientsConsumer authorization test", () => {
  const organizationId: TenantId = generateId();

  const clientSeed: authorizationApi.ClientSeed = {
    name: "Seed name",
    description: "Description",
    members: [organizationId],
  };

  const mockClient = getMockClient();

  const apiClient = clientToApiClient(mockClient, { showUsers: true });

  authorizationService.createConsumerClient = vi
    .fn()
    .mockResolvedValue({ client: mockClient, showUsers: true });

  const makeRequest = async (token: string) =>
    request(api)
      .post(`/clientsConsumer`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(clientSeed);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiClient);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const invalidMakeRequest = async (token: string) =>
      request(api)
        .post(`/clientsConsumer`)
        .set("Authorization", `Bearer ${token}`)
        .set("X-Correlation-Id", generateId())
        .send({});

    const res = await invalidMakeRequest(token);
    expect(res.status).toBe(400);
  });
});
