import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockEventService } from "../../vitest.api.setup.js";

describe("GET /agreementEvents router test", () => {
  const events: m2mGatewayApi.AgreementEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "AGREEMENT_ADDED",
      agreementId: generateId(),
      producerDelegationId: generateId(),
      consumerDelegationId: generateId(),
    },
  ];

  const mockAgreementEvents: m2mGatewayApi.AgreementEvents = {
    events,
  };

  const mockQueryParams: m2mGatewayApi.GetEventManagerAgreementsQueryParams = {
    lastEventId: generateId(),
    limit: 10,
    delegationId: generateId(),
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetEventManagerAgreementsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/agreementEvents`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEventService.getAgreementEvents = vi
        .fn()
        .mockResolvedValue(mockAgreementEvents);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAgreementEvents);
      expect(mockEventService.getAgreementEvents).toHaveBeenCalledWith(
        mockQueryParams,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockQueryParams);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...mockQueryParams, limit: 0 },
    { ...mockQueryParams, limit: 501 },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, limit: undefined },
    { ...mockQueryParams, lastEventId: -1 },
    { ...mockQueryParams, lastEventId: "invalidEventId" },
    { ...mockQueryParams, delegationId: 1 },
    { ...mockQueryParams, delegationId: "invalidDelegationId" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetEventManagerAgreementsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
