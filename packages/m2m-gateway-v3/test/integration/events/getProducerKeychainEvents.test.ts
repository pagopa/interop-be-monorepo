import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, m2mEventApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getProducerKeychainEvents integration", () => {
  const events: m2mEventApi.ProducerKeychainM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PRODUCER_KEYCHAIN_ADDED",
      producerKeychainId: generateId(),
    },
  ];
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
      const expectedResponse: m2mGatewayApiV3.ProducerKeychainEvents = {
        events,
      };
      const result = await eventService.getProducerKeychainEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
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
