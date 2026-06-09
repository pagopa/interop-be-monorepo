/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { attributeKind, generateId, Tenant } from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  attributeNotFoundInTenant,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API DELETE /internal/origin/{tOrigin}/remoteId/{tRemoteId}/certifiedDiscreteAttributes/origin/{aOrigin}/externalId/{aExternalId} test", () => {
  const attribute = getMockAttribute(attributeKind.certified);
  const tRemoteId = "015146";
  const targetTenant: Tenant = {
    ...getMockTenant(),
    attributes: [],
    remoteIds: [
      { origin: "ISTAT", value: tRemoteId, assignmentTimestamp: new Date() },
    ],
  };

  beforeEach(() => {
    tenantService.internalRevokeCertifiedDiscreteAttribute = vi
      .fn()
      .mockResolvedValue({ version: 1 });
  });

  const makeRequest = async (token: string) =>
    request(api)
      .delete(
        `/internal/origin/${targetTenant.externalId.origin}/remoteId/${tRemoteId}/certifiedDiscreteAttributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(204);
    expect(res.headers["x-metadata-version"]).toBe("1");

    expect(
      tenantService.internalRevokeCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: attribute.origin,
        attributeExternalId: attribute.code,
      },
      expect.anything()
    );
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotFound(targetTenant.id), expectedStatus: 404 },
    {
      error: attributeNotFoundInTenant(attribute.id, targetTenant.id),
      expectedStatus: 404,
    },
    {
      error: attributeNotFound(attribute.id),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.internalRevokeCertifiedDiscreteAttribute = vi
        .fn()
        .mockRejectedValue(error);

      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(expectedStatus);
    }
  );
});
