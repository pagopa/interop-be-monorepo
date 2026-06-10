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
  certifiedDiscreteAttributeAlreadyAssigned,
  tenantNotFound,
  tenantNotFoundByRemoteId,
} from "../../src/model/domain/errors.js";

describe("API POST /internal/origin/{tOrigin}/remoteId/{tRemoteId}/certifiedDiscreteAttributes/origin/{aOrigin}/externalId/{aExternalId} test", () => {
  const attribute = getMockAttribute(attributeKind.certified);
  const targetTenant: Tenant = {
    ...getMockTenant(),
    attributes: [],
    remoteIds: [
      { origin: "ISTAT", value: "015146", assignmentTimestamp: new Date() },
    ],
  };
  const tRemoteId = "015146";
  const mockPayload = { value: 1350000 };

  beforeEach(() => {
    tenantService.internalAssignCertifiedDiscreteAttribute = vi
      .fn()
      .mockResolvedValue({ version: 1 });
  });

  const makeRequest = async (token: string) =>
    request(api)
      .post(
        `/internal/origin/${targetTenant.externalId.origin}/remoteId/${tRemoteId}/certifiedDiscreteAttributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .send(mockPayload)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(204);
    expect(res.headers["x-metadata-version"]).toBe("1");

    expect(
      tenantService.internalAssignCertifiedDiscreteAttribute
    ).toHaveBeenCalledWith(
      {
        tenantOrigin: targetTenant.externalId.origin,
        tenantRemoteId: tRemoteId,
        attributeOrigin: attribute.origin,
        attributeExternalId: attribute.code,
        value: mockPayload.value,
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
    { error: attributeNotFound(generateId()), expectedStatus: 404 },
    {
      error: certifiedDiscreteAttributeAlreadyAssigned(
        generateId(),
        generateId()
      ),
      expectedStatus: 409,
    },
    {
      error: tenantNotFoundByRemoteId("ISTAT", generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.internalAssignCertifiedDiscreteAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if value in payload is missing or invalid", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await request(api)
      .post(
        `/internal/origin/${targetTenant.externalId.origin}/remoteId/${tRemoteId}/certifiedDiscreteAttributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .send({ value: "not-a-number" })
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

    expect(res.status).toBe(400);
  });
});
