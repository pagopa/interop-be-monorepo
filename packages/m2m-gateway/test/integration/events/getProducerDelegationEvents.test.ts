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

describe("getProducerDelegationEvents integration", () => {
  const events: m2mEventApi.ProducerDelegationM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PRODUCER_DELEGATION_APPROVED",
      delegationId: generateId(),
    },
  ];

  const mockEventManagerResponse: m2mEventApi.ProducerDelegationM2MEvents = {
    events,
  };

  const mockGetProducerDelegationM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getProducerDelegationM2MEvents: mockGetProducerDelegationM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetProducerDelegationM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.ProducerDelegationEvents = {
        events,
      };
      const result = await eventService.getProducerDelegationEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetProducerDelegationM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
