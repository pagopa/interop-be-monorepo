/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockProducerKeychain,
  getMockWithMetadata,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import {
  eventConflictError,
  generateId,
  hyperlinkDetectionError,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  producerKeychainNotFound,
  tenantNotAllowedOnProducerKeychain,
} from "../../src/model/domain/errors.js";
import { testToFullProducerKeychain } from "../apiUtils.js";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API PATCH /producerKeychains/{producerKeychainId}", () => {
  const producerKeychain = getMockWithMetadata(
    getMockProducerKeychain({ producerId: mockTokenOrganizationId }),
    2
  );
  const seed = { name: "Updated name", description: "Updated description" };
  const makeRequest = async (
    role: AuthRole,
    body: object = seed,
    id: string = producerKeychain.data.id
  ) =>
    request(api)
      .patch(`/producerKeychains/${id}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    authorizationService.updateProducerKeychain = vi
      .fn()
      .mockResolvedValue(producerKeychain);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)("should allow %s", async (role) => {
    const res = await makeRequest(role);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(testToFullProducerKeychain(producerKeychain.data));
    expect(res.headers["x-metadata-version"]).toBe("2");
    expect(
      authorizationService.updateProducerKeychain
    ).toHaveBeenCalledExactlyOnceWith(
      { producerKeychainId: producerKeychain.data.id, seed },
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("should reject %s", async (role) => {
    expect((await makeRequest(role)).status).toBe(403);
    expect(authorizationService.updateProducerKeychain).not.toHaveBeenCalled();
  });

  it.each([
    { name: "n".repeat(5) },
    { name: "n".repeat(60) },
    { description: "d".repeat(10) },
    { description: "d".repeat(250) },
  ])("should accept boundaries and omitted fields: %s", async (body) => {
    expect((await makeRequest(authRole.ADMIN_ROLE, body)).status).toBe(200);
    expect(
      authorizationService.updateProducerKeychain
    ).toHaveBeenCalledExactlyOnceWith(
      { producerKeychainId: producerKeychain.data.id, seed: body },
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
    { ...seed, producerId: generateId() },
    { ...seed, members: [] },
    { ...seed, keys: [] },
    { ...seed, eservices: [] },
    { name: seed.name, description: null },
    { description: seed.description, name: null },
    { name: seed.name, extra: true },
    { description: seed.description, extra: true },
  ])("should reject invalid payload: %s", async (body) => {
    expect((await makeRequest(authRole.ADMIN_ROLE, body)).status).toBe(400);
    expect(authorizationService.updateProducerKeychain).not.toHaveBeenCalled();
  });

  it("should reject an invalid id", async () => {
    expect(
      (await makeRequest(authRole.ADMIN_ROLE, seed, "invalid")).status
    ).toBe(400);
    expect(authorizationService.updateProducerKeychain).not.toHaveBeenCalled();
  });

  it.each([
    { error: producerKeychainNotFound(producerKeychain.data.id), status: 404 },
    {
      error: tenantNotAllowedOnProducerKeychain(
        generateId(),
        producerKeychain.data.id
      ),
      status: 403,
    },
    { error: hyperlinkDetectionError("https://example.com"), status: 400 },
    {
      error: eventConflictError(generateId(), producerKeychain.data.id, 0),
      status: 409,
    },
  ])("should map $error.code to $status", async ({ error, status }) => {
    authorizationService.updateProducerKeychain = vi
      .fn()
      .mockRejectedValue(error);
    expect((await makeRequest(authRole.ADMIN_ROLE)).status).toBe(status);
  });
});
