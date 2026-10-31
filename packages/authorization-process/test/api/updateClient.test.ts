/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockClient,
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import {
  clientKind,
  eventConflictError,
  generateId,
  hyperlinkDetectionError,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clientKindNotAllowed,
  clientNotFound,
  tenantNotAllowedOnClient,
} from "../../src/model/domain/errors.js";
import { testToFullClient } from "../apiUtils.js";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API PATCH /clients/{clientId}", () => {
  const client = getMockWithMetadata(
    {
      ...getMockClient({
        consumerId: mockTokenOrganizationId,
        kind: clientKind.consumer,
      }),
      name: "Updated client",
      description: "Updated description",
    },
    2
  );
  const seed = { name: client.data.name, description: client.data.description };
  const makeRequest = async (
    role: AuthRole,
    body: object = seed,
    clientId: string = client.data.id
  ) =>
    request(api)
      .patch(`/clients/${clientId}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    authorizationService.updateClient = vi.fn().mockResolvedValue(client);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)("should allow %s", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(testToFullClient(client.data));
    expect(res.headers["x-metadata-version"]).toBe("2");
    expect(authorizationService.updateClient).toHaveBeenCalledExactlyOnceWith(
      { clientId: client.data.id, seed },
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("should reject %s", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(403);
    expect(authorizationService.updateClient).not.toHaveBeenCalled();
  });

  it.each([
    { name: "n".repeat(5) },
    { name: "n".repeat(60) },
    { description: "d".repeat(10) },
    { description: "d".repeat(250) },
  ])("should accept valid boundaries and omitted fields: %s", async (body) => {
    const res = await makeRequest(authRole.ADMIN_ROLE, body);
    expect(res.status).toBe(200);
    expect(authorizationService.updateClient).toHaveBeenCalledWith(
      { clientId: client.data.id, seed: body },
      expect.anything()
    );
  });

  it.each([
    {},
    { name: "n".repeat(4) },
    { name: "n".repeat(61) },
    { description: "d".repeat(9) },
    { description: "d".repeat(251) },
    { name: null },
    { description: null },
    { name: 42 },
    { description: true },
    { ...seed, consumerId: generateId() },
    { ...seed, kind: "API" },
    { ...seed, members: [] },
    { name: seed.name, description: null },
  ])("should reject invalid payload: %s", async (body) => {
    const res = await makeRequest(authRole.ADMIN_ROLE, body);
    expect(res.status).toBe(400);
    expect(authorizationService.updateClient).not.toHaveBeenCalled();
  });

  it("should reject an invalid client id", async () => {
    const res = await makeRequest(authRole.ADMIN_ROLE, seed, "invalid");
    expect(res.status).toBe(400);
    expect(authorizationService.updateClient).not.toHaveBeenCalled();
  });

  it.each([
    { error: clientNotFound(client.data.id), status: 404 },
    {
      error: tenantNotAllowedOnClient(generateId(), client.data.id),
      status: 403,
    },
    { error: clientKindNotAllowed(client.data.id), status: 403 },
    { error: hyperlinkDetectionError("https://example.com"), status: 400 },
    {
      error: eventConflictError(generateId(), client.data.id, 0),
      status: 409,
    },
  ])("should map $error.code to $status", async ({ error, status }) => {
    authorizationService.updateClient = vi.fn().mockRejectedValue(error);
    const res = await makeRequest(authRole.ADMIN_ROLE);
    expect(res.status).toBe(status);
  });
});
