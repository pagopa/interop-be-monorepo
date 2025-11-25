import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ConsumerDelegationM2MEventType,
  generateId,
} from "pagopa-interop-models";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, mockEventService } from "../../vitest.api.setup.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("GET /consumerDelegationEvents router test", () => {
  const eventTypes = ConsumerDelegationM2MEventType.options;
  const events: m2mGatewayApi.ConsumerDelegationEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        delegationId: generateId(),
      } as m2mGatewayApi.ConsumerDelegationEvent)
  );

  const mockConsumerDelegationEvents: m2mGatewayApi.ConsumerDelegationEvents = {
    events,
  };

  const mockQueryParams: m2mGatewayApi.GetEventManagerConsumerDelegationsQueryParams =
    {
      lastEventId: generateId(),
      limit: 10,
    };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetEventManagerConsumerDelegationsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/consumerDelegationEvents`)
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
      mockEventService.getConsumerDelegationEvents = vi
        .fn()
        .mockResolvedValue(mockConsumerDelegationEvents);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockConsumerDelegationEvents);
      expect(mockEventService.getConsumerDelegationEvents).toHaveBeenCalledWith(
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
    { ...mockQueryParams, lastEventId: "invalidEventId" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetEventManagerConsumerDelegationsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
