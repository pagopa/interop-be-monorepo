/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, ClientId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test/index.js";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import { clientNotFound } from "../../src/model/domain/errors.js";
import { testToPartialClient, testToFullClient } from "../apiUtils.js";

describe("API /clients/{clientId} authorization test", () => {
  const mockClient: Client = getMockClient();
  const serviceResponse = getMockWithMetadata(mockClient);
  authorizationService.getClientById = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (token: string, clientId: ClientId) =>
    request(api)
      .get(`/clients/${clientId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 with a partial client for user with role %s and tenant != client consumerId",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToPartialClient(mockClient));
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s and tenant = client consumerId",
    async (role) => {
      const mockClient = getMockClient({
        consumerId: mockTokenOrganizationId,
      });
      const serviceResponse = getMockWithMetadata(mockClient);
      authorizationService.getClientById = vi
        .fn()
        .mockResolvedValueOnce(serviceResponse);
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.getClientById = vi.fn().mockRejectedValue(error);

      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        mockClient.id
      );
      expect(res.status).toBe(expectedStatus);
    }
  );
});
