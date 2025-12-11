import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  ConsumerDelegationM2MEventType,
  generateId,
} from "pagopa-interop-models";
import {
  generateM2MEventId,
  getMockedConsumerDelegationM2MEvent,
} from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { toApiConsumerDelegationM2MEventType } from "../../src/model/delegationM2MEventApiConverter.js";

describe("API /events/consumerDelegations test", () => {
  const mockConsumerDelegationM2MEvents = ConsumerDelegationM2MEventType.options
    .map((type) => [
      getMockedConsumerDelegationM2MEvent(type),
      getMockedConsumerDelegationM2MEvent(type),
    ])
    .flat();

  const mockConsumerDelegationM2MEventsResponse: m2mEventApi.ConsumerDelegationM2MEvents =
    {
      events: mockConsumerDelegationM2MEvents.map(
        (e) =>
          ({
            id: e.id,
            eventType: toApiConsumerDelegationM2MEventType(e.eventType),
            eventTimestamp: e.eventTimestamp.toJSON(),
            delegationId: e.delegationId,
          } as m2mEventApi.ConsumerDelegationM2MEvent)
      ),
    };

  const mockQueryParams: m2mEventApi.GetConsumerDelegationM2MEventsQueryParams =
    {
      lastEventId: generateM2MEventId(),
      limit: 10,
    };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetConsumerDelegationM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/consumerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      m2mEventService.getConsumerDelegationM2MEvents = vi
        .fn()
        .mockResolvedValue(mockConsumerDelegationM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockConsumerDelegationM2MEventsResponse);
      expect(
        m2mEventService.getConsumerDelegationM2MEvents
      ).toHaveBeenCalledWith(
        mockQueryParams.lastEventId,
        mockQueryParams.limit,
        expect.any(Object)
      );
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
    { ...mockQueryParams, limit: 0 },
    { ...mockQueryParams, limit: 501 },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, limit: undefined },
    { ...mockQueryParams, lastEventId: -1 },
    { ...mockQueryParams, lastEventId: "invalidLastEventId" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mEventApi.GetConsumerDelegationM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
