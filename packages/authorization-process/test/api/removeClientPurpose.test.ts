/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Client, PurposeId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";
import {
  clientKindNotAllowed,
  clientNotFound,
  organizationNotAllowedOnClient,
} from "../../src/model/domain/errors.js";

describe("API /clients/{clientId}/purposes/{purposeId} authorization test", () => {
  const purposeIdToRemove: PurposeId = generateId();
  const purposeIdToNotRemove: PurposeId = generateId();

  const mockClient: Client = {
    ...getMockClient(),
    purposes: [purposeIdToRemove, purposeIdToNotRemove],
  };

  const makeRequest = async (
    token: string,
    clientId: string,
    purposeId: string
  ) =>
    request(api)
      .delete(`/clients/${clientId}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];

  authorizationService.removeClientPurpose = vi.fn().mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for clientNotFound", async () => {
    authorizationService.removeClientPurpose = vi
      .fn()
      .mockRejectedValue(clientNotFound(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotAllowedOnClient", async () => {
    authorizationService.removeClientPurpose = vi
      .fn()
      .mockRejectedValue(
        organizationNotAllowedOnClient(generateId(), mockClient.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for clientKindNotAllowed", async () => {
    authorizationService.removeClientPurpose = vi
      .fn()
      .mockRejectedValue(clientKindNotAllowed(mockClient.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockClient.id, purposeIdToRemove);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid", "invalid");
    expect(res.status).toBe(400);
  });
});
