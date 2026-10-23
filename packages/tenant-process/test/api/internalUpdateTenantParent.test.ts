/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { tenantApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { eventConflictError, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  tenantNotFoundByExternalId,
  uoParentMustBeRootOrAoo,
} from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("POST /internal/origin/:tOrigin/externalId/:tExternalId/parent", () => {
  const tenant = getMockTenant();
  const seed: tenantApi.TenantParentSeed = {
    parentTenantId: generateId(),
    rootTenantId: generateId(),
  };

  beforeEach(() => {
    tenantService.internalUpdateTenantParent = vi.fn().mockResolvedValue({
      data: tenant,
      metadata: { version: 2 },
    });
  });

  const makeRequest = (token: string, body: object = seed) =>
    request(api)
      .post(
        `/internal/origin/${tenant.externalId.origin}/externalId/${tenant.externalId.value}/parent`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("returns the updated tenant and metadata version to internal callers", async () => {
    const response = await makeRequest(generateToken(authRole.INTERNAL_ROLE));

    expect(response.status).toBe(200);
    expect(response.headers["x-metadata-version"]).toBe("2");
    expect(response.body).toEqual(tenantApi.Tenant.parse(toApiTenant(tenant)));
    expect(tenantService.internalUpdateTenantParent).toHaveBeenCalledWith(
      {
        tenantOrigin: tenant.externalId.origin,
        tenantExternalId: tenant.externalId.value,
        ...seed,
      },
      expect.anything()
    );
  });

  it("accepts null for both references to clear the hierarchy", async () => {
    const body = { parentTenantId: null, rootTenantId: null };
    const response = await makeRequest(
      generateToken(authRole.INTERNAL_ROLE),
      body
    );

    expect(response.status).toBe(200);
    expect(tenantService.internalUpdateTenantParent).toHaveBeenCalledWith(
      {
        tenantOrigin: tenant.externalId.origin,
        tenantExternalId: tenant.externalId.value,
        ...body,
      },
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("rejects non-internal role %s", async (role) => {
    expect((await makeRequest(generateToken(role))).status).toBe(403);
  });

  it.each([
    {},
    { parentTenantId: seed.parentTenantId },
    { parentTenantId: "not-a-uuid", rootTenantId: seed.rootTenantId },
    { parentTenantId: seed.parentTenantId, rootTenantId: "not-a-uuid" },
    {
      parentTenantId: seed.parentTenantId,
      rootTenantId: seed.rootTenantId,
      extra: true,
    },
  ])("rejects an invalid TenantParentSeed: %o", async (body) => {
    expect(
      (await makeRequest(generateToken(authRole.INTERNAL_ROLE), body)).status
    ).toBe(400);
  });

  it.each([
    {
      error: tenantNotFoundByExternalId(
        tenant.externalId.origin,
        tenant.externalId.value
      ),
      expectedStatus: 404,
    },
    {
      error: uoParentMustBeRootOrAoo(tenant.id),
      expectedStatus: 400,
    },
    { error: eventConflictError(), expectedStatus: 409 },
  ])(
    "maps endpoint errors to $expectedStatus",
    async ({ error, expectedStatus }) => {
      tenantService.internalUpdateTenantParent = vi
        .fn()
        .mockRejectedValue(error);

      expect(
        (await makeRequest(generateToken(authRole.INTERNAL_ROLE))).status
      ).toBe(expectedStatus);
    }
  );
});
