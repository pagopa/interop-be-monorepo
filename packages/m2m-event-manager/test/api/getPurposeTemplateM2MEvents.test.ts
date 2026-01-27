import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  PurposeTemplateM2MEventType,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import {
  generateM2MEventId,
  getMockedPurposeTemplateM2MEvent,
} from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { toApiPurposeTemplateM2MEventType } from "../../src/model/purposeTemplateM2MEventApiConverter.js";

describe("API /events/purposeTemplates test", () => {
  const mockPurposeTemplateM2MEvents = PurposeTemplateM2MEventType.options
    .map((eventType) => [
      getMockedPurposeTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedPurposeTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .flat();

  const mockPurposeTemplateM2MEventsResponse: m2mEventApi.PurposeTemplateM2MEvents =
    {
      events: mockPurposeTemplateM2MEvents.map(
        (e) =>
          ({
            id: e.id,
            eventTimestamp: e.eventTimestamp.toJSON(),
            eventType: toApiPurposeTemplateM2MEventType(e.eventType),
            purposeTemplateId: e.purposeTemplateId,
          } as m2mEventApi.PurposeTemplateM2MEvent)
      ),
    };

  const mockQueryParams: m2mEventApi.GetPurposeTemplateM2MEventsQueryParams = {
    lastEventId: generateM2MEventId(),
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetPurposeTemplateM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/purposeTemplates`)
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
      m2mEventService.getPurposeTemplateM2MEvents = vi
        .fn()
        .mockResolvedValue(mockPurposeTemplateM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPurposeTemplateM2MEventsResponse);
      expect(m2mEventService.getPurposeTemplateM2MEvents).toHaveBeenCalledWith(
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
      query as unknown as m2mEventApi.GetPurposeTemplateM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
