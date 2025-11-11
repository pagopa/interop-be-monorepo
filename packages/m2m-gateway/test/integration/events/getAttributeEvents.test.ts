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

describe("getAttributeEvents integration", () => {
  const mockAttributeEvent1: m2mEventApi.AttributeM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "ATTRIBUTE_ADDED",
    attributeId: generateId(),
  };

  const mockAttributeEvent2: m2mEventApi.AttributeM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "ATTRIBUTE_ADDED",
    attributeId: generateId(),
  };

  const mockEventManagerResponse: m2mEventApi.AttributeM2MEvents = {
    events: [mockAttributeEvent1, mockAttributeEvent2],
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

  it("Should succeed and perform API clients calls", async () => {
    const expectedResponse: m2mGatewayApi.AttributeEvents = {
      events: [mockAttributeEvent1, mockAttributeEvent2],
    };

    const result = await eventService.getAttributeEvents(
      {
        lastEventId: generateId(),
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );
    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetAttributeM2MEvents,
      queries: {
        lastEventId: expect.any(String),
        limit: 10,
      },
    });
  });

  it("Should succeed without lastEventId", async () => {
    const expectedResponse: m2mGatewayApi.AttributeEvents = {
      events: [mockAttributeEvent1, mockAttributeEvent2],
    };

    const result = await eventService.getAttributeEvents(
      {
        limit: 20,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetAttributeM2MEvents,
      queries: {
        lastEventId: undefined,
        limit: 20,
      },
    });
  });
});
