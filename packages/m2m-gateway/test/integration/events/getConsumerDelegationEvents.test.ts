import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getConsumerDelegationEvents integration", () => {
  const events: m2mEventApi.ConsumerDelegationM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "CONSUMER_DELEGATION_APPROVED",
      delegationId: generateId(),
    },
  ];

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
      expect(result).toStrictEqual(expectedResponse);
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
