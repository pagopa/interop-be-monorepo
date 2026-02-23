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

describe("getProducerKeyEvents integration", () => {
  const events: m2mEventApi.ProducerKeyM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PRODUCER_KEYCHAIN_KEY_ADDED",
      producerKeychainId: generateId(),
      kid: generateId(),
    },
  ];

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
      const expectedResponse: m2mGatewayApiV3.ProducerKeyEvents = {
        events,
      };
      const result = await eventService.getProducerKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
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
