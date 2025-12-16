import { describe, it, expect, vi } from "vitest";
import { m2mEventApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  AgreementM2MEventType,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import {
  generateM2MEventId,
  getMockedAgreementM2MEvent,
} from "../mockUtils.js";
import { api, m2mEventService } from "../vitest.api.setup.js";
import { toApiAgreementM2MEventType } from "../../src/model/agreementM2MEventApiConverter.js";

describe("API /events/agreements test", () => {
  const mockAgreementM2MEvents = AgreementM2MEventType.options
    .map((eventType) => [
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
      }),
      getMockedAgreementM2MEvent({
        eventType,
        visibility: m2mEventVisibility.restricted,
      }),
    ])
    .flat();

  const mockAgreementM2MEventsResponse: m2mEventApi.AgreementM2MEvents = {
    events: mockAgreementM2MEvents.map(
      (e) =>
        ({
          id: e.id,
          eventTimestamp: e.eventTimestamp.toJSON(),
          eventType: toApiAgreementM2MEventType(e.eventType),
          agreementId: e.agreementId,
          consumerDelegationId: e.consumerDelegationId,
          producerDelegationId: e.producerDelegationId,
        } as m2mEventApi.AgreementM2MEvent)
    ),
  };

  const mockQueryParams: m2mEventApi.GetAgreementM2MEventsQueryParams = {
    lastEventId: generateM2MEventId(),
    limit: 10,
    delegationId: generateId(),
  };

  const makeRequest = async (
    token: string,
    query: m2mEventApi.GetAgreementM2MEventsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`/events/agreements`)
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
      m2mEventService.getAgreementM2MEvents = vi
        .fn()
        .mockResolvedValue(mockAgreementM2MEvents);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockAgreementM2MEventsResponse);
      expect(m2mEventService.getAgreementM2MEvents).toHaveBeenCalledWith(
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

  it.each([generateId(), "null", undefined])(
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
    { ...mockQueryParams, delegationId: "invalidDelegationId" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mEventApi.GetAgreementM2MEventsQueryParams
    );

    expect(res.status).toBe(400);
  });
});
