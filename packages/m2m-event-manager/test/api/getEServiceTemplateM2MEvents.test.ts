import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  EServiceTemplateM2MEventType,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import {
  generateM2MEventId,
  getMockedEServiceTemplateM2MEvent,
} from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { testToUpperSnakeCase } from "../utils.js";

describe("API /events/eserviceTemplates test", () => {
  const mockEServiceTemplateM2MEvents = EServiceTemplateM2MEventType.options
    .map((eventType) => [
      getMockedEServiceTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedEServiceTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .flat();

  const mockEServiceTemplateM2MEventsResponse: m2mEventApi.EServiceTemplateM2MEvents =
    {
      events: mockEServiceTemplateM2MEvents.map(
        (e) =>
          ({
            id: e.id,
            eventTimestamp: e.eventTimestamp.toJSON(),
            eventType: testToUpperSnakeCase(e.eventType),
            eserviceTemplateId: e.eserviceTemplateId,
          } as m2mEventApi.EServiceTemplateM2MEvent)
      ),
    };

  const mockQueryParams: m2mEventApi.GetEServiceTemplateM2MEventsQueryParams = {
    lastEventId: generateM2MEventId(),
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetEServiceTemplateM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/eserviceTemplates`)
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
      m2mEventService.getEServiceTemplateM2MEvents = vi
        .fn()
        .mockResolvedValue(mockEServiceTemplateM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockEServiceTemplateM2MEventsResponse);
      expect(m2mEventService.getEServiceTemplateM2MEvents).toHaveBeenCalledWith(
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
    { ...mockQueryParams, delegationId: 1 },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mEventApi.GetEServiceTemplateM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
