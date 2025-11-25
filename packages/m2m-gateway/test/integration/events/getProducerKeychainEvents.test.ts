import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import {
  ProducerKeychainM2MEventType,
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

describe("getProducerKeychainEvents integration", () => {
  const eventTypes = ProducerKeychainM2MEventType.options;
  const events: m2mEventApi.ProducerKeychainM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        producerKeychainId: generateId(),
      } as m2mEventApi.ProducerKeychainM2MEvent)
  );
  const mockEventManagerResponse: m2mEventApi.ProducerKeychainM2MEvents = {
    events,
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
        events,
      };
      const result = await eventService.getProducerKeychainEvents(
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
