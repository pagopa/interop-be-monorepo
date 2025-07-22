/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Client, PurposeId, ClientId } from "pagopa-interop-models";
import {
  generateToken,
  getMockClient,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKindNotAllowed,
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";

describe("API /clients/{clientId}/purposes/{purposeId} authorization test", () => {
  const purposeIdToRemove: PurposeId = generateId();
  const purposeIdToNotRemove: PurposeId = generateId();

  const mockClient: Client = {
    ...getMockClient(),
    purposes: [purposeIdToRemove, purposeIdToNotRemove],
  };
  const serviceResponse = getMockWithMetadata(mockClient);

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    purposeId: PurposeId
  ) =>
    request(api)
      .delete(`/clients/${clientId}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  authorizationService.removeClientPurpose = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  it.each(authorizedRoles)(
    "Should return 200 with a full client for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(testToFullClient(mockClient));
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(authorizationService.removeClientPurpose).toHaveBeenCalledWith(
        {
          clientId: mockClient.id,
          purposeIdToRemove,
        },
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: clientNotFound(mockClient.id),
      expectedStatus: 404,
    },
    {
      error: tenantNotAllowedOnClient(generateId(), mockClient.id),
      expectedStatus: 403,
    },
    {
      error: clientKindNotAllowed(mockClient.id),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      authorizationService.removeClientPurpose = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { clientId: "invalidId", purposeId: purposeIdToRemove },
    { clientId: mockClient.id, purposeId: "invalidId" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ clientId, purposeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId as ClientId,
        purposeId as PurposeId
      );

      expect(res.status).toBe(400);
    }
  );
});
