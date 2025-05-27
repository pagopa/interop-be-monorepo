/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { agreementNotFound } from "../../src/models/errors.js";

describe("GET /agreements/:agreementId route test", () => {
  const agreementId: agreementApi.Agreement["id"] = generateId();

  const agreement: apiGatewayApi.Agreement = {
    id: agreementId,
    eserviceId: generateId(),
    descriptorId: generateId(),
    producerId: generateId(),
    consumerId: generateId(),
    state: apiGatewayApi.AgreementState.Values.ACTIVE,
  };

  const makeRequest = async (
    token: string,
    id: apiGatewayApi.Agreement["id"] = agreement.id
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [authRole.M2M_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and the agreement for authorized role %s",
    async (role) => {
      // eslint-disable-next-line functional/immutable-data
      mockAgreementService.getAgreementById = vi
        .fn()
        .mockResolvedValue(agreement);

      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(agreement);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for unauthorized role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if agreementId is not a valid UUID", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "invalid-uuid");
    expect(res.status).toBe(400);
  });

  it("Should return 404 if agreement is not found", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockAgreementService.getAgreementById = vi
      .fn()
      .mockRejectedValue(agreementNotFound(agreementId));

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 500 if API model parsing fails", async () => {
    const invalidAgreement = {
      ...agreement,
      state: "INVALID_STATE",
    };

    // eslint-disable-next-line functional/immutable-data
    mockAgreementService.getAgreementById = vi
      .fn()
      .mockResolvedValue(invalidAgreement);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });
});
