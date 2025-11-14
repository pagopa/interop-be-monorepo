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

describe("getProducerKeychainEvents integration", () => {
  const mockProducerKeychainEvent1: m2mEventApi.ProducerKeychainM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "PRODUCER_KEYCHAIN_ADDED",
    producerKeychainId: generateId(),
  };

  const mockProducerKeychainEvent2: m2mEventApi.ProducerKeychainM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "PRODUCER_KEYCHAIN_DELETED",
    producerKeychainId: generateId(),
  };

  const mockEventManagerResponse: m2mEventApi.ProducerKeychainM2MEvents = {
    events: [mockProducerKeychainEvent1, mockProducerKeychainEvent2],
  };

  const mockGetProducerKeychainM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getProducerKeychainM2MEvents: mockGetProducerKeychainM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetProducerKeychainM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.ProducerKeychainEvents = {
        events: [mockProducerKeychainEvent1, mockProducerKeychainEvent2],
      };
      const result = await eventService.getProducerKeychainsEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetProducerKeychainM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
