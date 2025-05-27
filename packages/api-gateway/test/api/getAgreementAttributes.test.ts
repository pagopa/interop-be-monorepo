/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { agreementNotFound } from "../../src/models/errors.js";

describe("GET /agreements/:agreementId/attributes route test", () => {
  const agreementId: agreementApi.Agreement["id"] = generateId();

  const attributes: apiGatewayApi.Attributes = {
    certified: [],
    declared: [],
    verified: [],
  };

  const makeRequest = async (
    token: string,
    id: agreementApi.Agreement["id"] = agreementId
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/${id}/attributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.M2M_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.getAgreementAttributes = vi
        .fn()
        .mockResolvedValue(attributes);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(attributes);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if agreementId is not a valid UUID", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "invalid-uuid");
    expect(res.status).toBe(400);
  });

  it("Should return 404 if agreement not found", async () => {
    mockAgreementService.getAgreementAttributes = vi
      .fn()
      .mockRejectedValue(agreementNotFound(agreementId));

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(404);
  });

  it("Should return 500 if response parsing fails", async () => {
    mockAgreementService.getAgreementAttributes = vi.fn().mockResolvedValue({
      ...attributes,
      verified: [{ id: "invalid", explicitAttributeVerification: {} }],
    });

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });
});
