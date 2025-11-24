import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { AttributeM2MEventType, generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("getAttributeEvents integration", () => {
  const eventTypes = AttributeM2MEventType.options;
  const events: m2mGatewayApi.AttributeEvent[] = eventTypes.map(
    (eventType) => ({
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: testToUpperSnakeCase(eventType),
      attributeId: generateId(),
    }) as m2mGatewayApi.AttributeEvent
  );

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
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.AttributeEvents = {
        events,
      };
      const result = await eventService.getAttributeEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
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
