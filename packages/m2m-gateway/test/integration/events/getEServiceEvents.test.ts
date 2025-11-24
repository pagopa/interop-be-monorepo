import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { EServiceM2MEventType, generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEServiceEvents integration", () => {
  const eventTypes = EServiceM2MEventType.options;
  const events: m2mGatewayApi.EServiceEvent[] = eventTypes.map((eventType) => ({
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: eventType as m2mGatewayApi.EServiceEvent["eventType"],
    eserviceId: generateId(),
  }));

  const mockEventManagerResponse: m2mEventApi.EServiceM2MEvents = {
    events,
  };

  const mockGetEServiceM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getEServiceM2MEvents: mockGetEServiceM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetEServiceM2MEvents.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedResponse: m2mGatewayApi.EServiceEvents = {
      events,
    };

    const result = await eventService.getEServiceEvents(
      {
        lastEventId: generateId(),
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );
    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServiceM2MEvents,
      queries: {
        lastEventId: expect.any(String),
        limit: 10,
      },
    });
  });

  it("Should succeed without lastEventId", async () => {
    const expectedResponse: m2mGatewayApi.EServiceEvents = {
      events,
    };

    const result = await eventService.getEServiceEvents(
      {
        limit: 20,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetEServiceM2MEvents,
      queries: {
        lastEventId: undefined,
        limit: 20,
      },
    });
  });
});
