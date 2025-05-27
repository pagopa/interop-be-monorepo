/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { producerAndConsumerParamMissing } from "../../src/models/errors.js";

describe("GET /agreements route test", () => {
  const consumerId = generateId();
  const eserviceId = generateId();
  const producerId = generateId();
  const descriptorId = generateId();

  const agreement1: apiGatewayApi.Agreement = {
    id: generateId(),
    eserviceId,
    descriptorId,
    producerId,
    consumerId,
    state: apiGatewayApi.AgreementState.Values.ACTIVE,
  };

  const agreement2: apiGatewayApi.Agreement = {
    id: generateId(),
    eserviceId,
    descriptorId,
    producerId,
    consumerId,
    state: apiGatewayApi.AgreementState.Values.SUSPENDED,
  };

  const agreementsResponse: apiGatewayApi.Agreements = {
    agreements: [agreement1, agreement2],
  };

  const mockQueryParams: apiGatewayApi.GetAgreementsQueryParams = {
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    states: ["ACTIVE", "SUSPENDED"],
  };

  const makeRequest = async (
    token: string,
    query: apiGatewayApi.GetAgreementsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      // eslint-disable-next-line functional/immutable-data
      mockAgreementService.getAgreements = vi
        .fn()
        .mockResolvedValue(agreementsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(agreementsResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should throw producerAndConsumerParamMissing", async () => {
    // eslint-disable-next-line functional/immutable-data
    mockAgreementService.getAgreements = vi
      .fn()
      .mockRejectedValue(producerAndConsumerParamMissing());
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockQueryParams, producerId: "invalid" },
    { ...mockQueryParams, consumerId: "invalid" },
    { ...mockQueryParams, eserviceId: "invalid-uuid" },
    { ...mockQueryParams, descriptorId: "invalid-uuid" },
    { ...mockQueryParams, states: ["INVALID_STATE"] },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      query as apiGatewayApi.GetAgreementsQueryParams
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {
      agreements: [
        { ...agreementsResponse.agreements[0], state: "INVALID_STATE" },
      ],
    },
    {
      agreements: [
        { ...agreementsResponse.agreements[0], producerId: "invalid-uuid" },
      ],
    },
    {
      agreements: [
        { ...agreementsResponse.agreements[0], consumerId: "invalid-uuid" },
      ],
    },
    {
      agreements: [
        { ...agreementsResponse.agreements[0], eserviceId: "invalid-uuid" },
      ],
    },
    {
      agreements: [
        { ...agreementsResponse.agreements[0], descriptorId: "invalid-uuid" },
      ],
    },
    {
      agreements: [{ ...agreementsResponse.agreements[0], id: "invalid-uuid" }],
    },
  ])(
    "Should return 500 when API model parsing fails for response %s",
    async (resp) => {
      // eslint-disable-next-line functional/immutable-data
      mockAgreementService.getAgreements = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
