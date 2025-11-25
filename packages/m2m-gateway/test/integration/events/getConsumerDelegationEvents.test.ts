import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import {
  ConsumerDelegationM2MEventType,
  generateId,
} from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("getConsumerDelegationEvents integration", () => {
  const eventTypes = ConsumerDelegationM2MEventType.options;
  const events: m2mEventApi.ConsumerDelegationM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        delegationId: generateId(),
      } as m2mEventApi.ConsumerDelegationM2MEvent)
  );

  const mockEventManagerResponse: m2mEventApi.ConsumerDelegationM2MEvents = {
    events,
  };

  const mockGetConsumerDelegationM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getConsumerDelegationM2MEvents: mockGetConsumerDelegationM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetConsumerDelegationM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.ConsumerDelegationEvents = {
        events,
      };
      const result = await eventService.getConsumerDelegationEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetConsumerDelegationM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
