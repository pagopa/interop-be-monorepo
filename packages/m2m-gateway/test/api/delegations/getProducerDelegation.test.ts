import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDelegation,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockDelegationService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiProducerDelegation } from "../../../src/api/delegationApiConverter.js";

describe("GET /producerDelegation/{delegationId} router test", () => {
  const mockApiDelegation = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
  });

  const mockM2MProducerDelegationResponse: m2mGatewayApi.ProducerDelegation =
    toM2MGatewayApiProducerDelegation(mockApiDelegation);

  const makeRequest = async (token: string, delegationId: string) =>
    request(api)
      .get(`${appBasePath}/producerDelegations/${delegationId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockDelegationService.getProducerDelegation = vi
        .fn()
        .mockResolvedValue(mockM2MProducerDelegationResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiDelegation.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MProducerDelegationResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiDelegation.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MProducerDelegationResponse, id: undefined },
    { ...mockM2MProducerDelegationResponse, invalidParam: "invalidValue" },
    { ...mockM2MProducerDelegationResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockDelegationService.getProducerDelegation = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiDelegation.id);

      expect(res.status).toBe(500);
    }
  );
});
