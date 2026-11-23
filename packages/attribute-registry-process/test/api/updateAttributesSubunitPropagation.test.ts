/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { AttributeId, generateId, TenantId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  attributeNotEligibleForSubunitPropagation,
  attributeSubunitPropagationSelectionNotValid,
  manualSubunitPropagationUpdateDisabled,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { api, attributeRegistryService } from "../vitest.api.setup.js";

describe("API POST /attributes/subunitPropagation/update", () => {
  const seed: attributeRegistryApi.AttributeSubunitPropagationUpdateSeed = {
    attributeIds: [generateId<AttributeId>()],
  };

  beforeEach(() => {
    attributeRegistryService.updateAttributesSubunitPropagation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (token: string, body: object = seed) =>
    request(api)
      .post("/attributes/subunitPropagation/update")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const res = await makeRequest(generateToken(role));
      expect(res.status).toBe(204);
      expect(
        attributeRegistryService.updateAttributesSubunitPropagation
      ).toHaveBeenCalledWith(seed, expect.anything());
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const res = await makeRequest(generateToken(role));
    expect(res.status).toBe(403);
  });

  it.each([
    { body: {} },
    { body: { attributeIds: ["not-a-uuid"] } },
    { body: { attributeIds: [generateId(), generateId()] } },
    { body: { attributeIds: [seed.attributeIds[0], seed.attributeIds[0]] } },
    { body: { ...seed, extraField: 1 } },
  ])("Should return 400 if passed an invalid body: %s", async ({ body }) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), body);
    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: attributeSubunitPropagationSelectionNotValid(),
      expectedStatus: 400,
    },
    {
      error: attributeNotEligibleForSubunitPropagation(
        generateId<AttributeId>(),
        generateId<TenantId>()
      ),
      expectedStatus: 400,
    },
    { error: tenantNotFound(generateId<TenantId>()), expectedStatus: 404 },
    { error: manualSubunitPropagationUpdateDisabled(), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus if the service throws $error.code",
    async ({ error, expectedStatus }) => {
      attributeRegistryService.updateAttributesSubunitPropagation = vi
        .fn()
        .mockRejectedValue(error);
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
      expect(res.status).toBe(expectedStatus);
    }
  );
});
