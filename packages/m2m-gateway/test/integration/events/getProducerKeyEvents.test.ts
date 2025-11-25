import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { ProducerKeyM2MEventType, generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("getProducerKeyEvents integration", () => {
  const eventTypes = ProducerKeyM2MEventType.options;
  const events: m2mEventApi.ProducerKeyM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        producerKeychainId: generateId(),
        kid: generateId(),
      } as m2mEventApi.ProducerKeyM2MEvent)
  );
  const mockEventManagerResponse: m2mEventApi.ProducerKeyM2MEvents = {
    events,
  };

  const mockGetProducerKeyM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getProducerKeyM2MEvents: mockGetProducerKeyM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetProducerKeyM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.ProducerKeyEvents = {
        events,
      };
      const result = await eventService.getProducerKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetProducerKeyM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
