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

describe("getClientEvents integration", () => {
  const events: m2mEventApi.ClientM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "CLIENT_ADDED",
      clientId: generateId(),
    },
  ];
  const mockEventManagerResponse: m2mEventApi.ClientM2MEvents = {
    events,
  };

  const mockGetClientM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getClientM2MEvents: mockGetClientM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetClientM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApiV3.ClientEvents = {
        events,
      };
      const result = await eventService.getClientEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetClientM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
