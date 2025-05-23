/* eslint-disable @typescript-eslint/explicit-function-return-type */
import request from "supertest";
import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import {
  generateId,
  Agreement,
  agreementState,
  EServiceId,
  TenantId,
  DescriptorId,
} from "pagopa-interop-models";
import { describe, vi, it, expect } from "vitest";
import { api, mockAgreementService } from "../vitest.api.setup.js";
import { Agreements } from "../../../api-clients/dist/apiGatewayApi.js";
import { agreementToApiAgreement } from "../../src/api/agreementApiConverter.js";

describe("API /agreements authorization test", () => {
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const producerId = generateId<TenantId>();
  const descriptorId = generateId<DescriptorId>();

  const agreement1: Agreement = {
    ...getMockAgreement(eserviceId, consumerId, agreementState.suspended),
    producerId,
    descriptorId,
  };

  const agreement2: Agreement = {
    ...getMockAgreement(eserviceId, consumerId, agreementState.suspended),
    producerId,
    descriptorId,
  };

  const apiAgreement1 = agreementApi.Agreement.parse(
    agreementToApiAgreement(agreement1)
  );

  const apiAgreement2 = agreementApi.Agreement.parse(
    agreementToApiAgreement(agreement2)
  );

  const agreementsResponse: Agreements = {
    agreements: [apiAgreement1, apiAgreement2],
  };

  const queryParams = {
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    states: ["ACTIVE", "SUSPENDED"],
  };

  const makeRequest = async (
    token: string,
    query: typeof queryParams = queryParams
  ) =>
    request(api)
      .get(`/agreements`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ROLE];

  it.only.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      console.log(res.text);

      expect(res.status).toBe(200);
      // expect(res.body).toEqual(
      //   apiGatewayApi.Agreements.parse(agreementsResponse)
      // );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...queryParams, producerId: "invalid" },
    { ...queryParams, consumerId: "invalid" },
    { ...queryParams, eserviceId: "invalid-uuid" },
    { ...queryParams, descriptorId: "invalid-uuid" },
    { ...queryParams, states: ["INVALID_STATE"] },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, query as typeof queryParams);
    expect(res.status).toBe(400);
  });
});
