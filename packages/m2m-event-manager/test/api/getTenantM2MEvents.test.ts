import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { TenantM2MEventType, generateId } from "pagopa-interop-models";
import { generateM2MEventId, getMockedTenantM2MEvent } from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { toApiTenantM2MEventType } from "../../src/model/tenantM2MEventApiConverter.js";

describe("API /events/tenants test", () => {
  const mockTenantM2MEvents = TenantM2MEventType.options
    .map((type) => [
      getMockedTenantM2MEvent(type),
      getMockedTenantM2MEvent(type),
    ])
    .flat();

  const mockTenantM2MEventsResponse: m2mEventApi.TenantM2MEvents = {
    events: mockTenantM2MEvents.map(
      (e) =>
        ({
          id: e.id,
          eventTimestamp: e.eventTimestamp.toJSON(),
          eventType: toApiTenantM2MEventType(e.eventType),
          tenantId: e.tenantId,
        } as m2mEventApi.TenantM2MEvent)
    ),
  };

  const mockQueryParams: m2mEventApi.GetTenantM2MEventsQueryParams = {
    lastEventId: generateM2MEventId(),
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetTenantM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/tenants`)
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
      m2mEventService.getTenantM2MEvents = vi
        .fn()
        .mockResolvedValue(mockTenantM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTenantM2MEventsResponse);
      expect(m2mEventService.getTenantM2MEvents).toHaveBeenCalledWith(
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
      query as unknown as m2mEventApi.GetTenantM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
