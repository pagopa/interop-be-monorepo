import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  EServiceM2MEventType,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { generateM2MEventId, getMockedEServiceM2MEvent } from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { testToUpperSnakeCase } from "../utils.js";

describe("API /events/eservices test", () => {
  const mockEServiceM2MEvents = EServiceM2MEventType.options
    .map((eventType) => [
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedEServiceM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .flat();

  const mockEServiceM2MEventsResponse: m2mEventApi.EServiceM2MEvents = {
    events: mockEServiceM2MEvents.map(
      (e) =>
        ({
          id: e.id,
          eventTimestamp: e.eventTimestamp.toJSON(),
          eventType: testToUpperSnakeCase(e.eventType),
          eserviceId: e.eserviceId,
          descriptorId: e.descriptorId,
          producerDelegationId: e.producerDelegationId,
        } as m2mEventApi.EServiceM2MEvent)
    ),
  };

  const mockQueryParams: m2mEventApi.GetEServiceM2MEventsQueryParams = {
    lastEventId: generateM2MEventId(),
    limit: 10,
    delegationId: generateId(),
  };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetEServiceM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/eservices`)
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
      m2mEventService.getEServiceM2MEvents = vi
        .fn()
        .mockResolvedValue(mockEServiceM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockEServiceM2MEventsResponse);
      expect(m2mEventService.getEServiceM2MEvents).toHaveBeenCalledWith(
        mockQueryParams.lastEventId,
        mockQueryParams.limit,
        mockQueryParams.delegationId,
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

  it.each([generateId(), null, undefined])(
    "Should accept delegationId query param as %s",
    async (delegationId) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, {
        ...mockQueryParams,
        delegationId,
      });
      expect(res.status).toBe(200);
    }
  );

  it.each([
    {},
    { ...mockQueryParams, limit: 0 },
    { ...mockQueryParams, limit: 501 },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, limit: undefined },
    { ...mockQueryParams, lastEventId: -1 },
    { ...mockQueryParams, lastEventId: "invalidLastEventId" },
    { ...mockQueryParams, delegationId: 1 },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mEventApi.GetEServiceM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
