/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Client, generateId, PurposeId } from "pagopa-interop-models";
import { generateToken, getMockClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /clients/purposes/{purposeId} authorization test", () => {
  const purposeIdToRemove: PurposeId = generateId();
  const purposeIdToNotRemove: PurposeId = generateId();

  const mockClient1: Client = {
    ...getMockClient(),
    purposes: [purposeIdToRemove, purposeIdToNotRemove],
  };
  const mockClient2: Client = {
    ...getMockClient(),
    purposes: [purposeIdToRemove, purposeIdToNotRemove],
  };
  const makeRequest = async (token: string, purposeId: PurposeId) =>
    request(api)
      .delete(`/clients/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send([mockClient1, mockClient2]);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.INTERNAL_ROLE,
  ];

  authorizationService.removePurposeFromClients = vi.fn().mockResolvedValue({});

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, purposeIdToRemove);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, purposeIdToRemove);
    expect(res.status).toBe(403);
  });

  it.each([{}, { purposeIdToRemove: "invalidId" }])(
    "Should return 400 if passed invalid params: %s",
    async ({ purposeIdToRemove }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeIdToRemove as PurposeId);

      expect(res.status).toBe(400);
    }
  );
});
