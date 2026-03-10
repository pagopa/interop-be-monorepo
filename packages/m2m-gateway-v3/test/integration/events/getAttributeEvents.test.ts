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

describe("getAttributeEvents integration", () => {
  const events: m2mEventApi.AttributeM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "ATTRIBUTE_ADDED",
      attributeId: generateId(),
    },
  ];

  const mockEventManagerResponse: m2mEventApi.AttributeM2MEvents = {
    events,
  };

  const mockGetAttributeM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getAttributeM2MEvents: mockGetAttributeM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetAttributeM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls with lastEventId: %s",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApiV3.AttributeEvents = {
        events,
      };
      const result = await eventService.getAttributeEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetAttributeM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
