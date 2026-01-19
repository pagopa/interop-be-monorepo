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

describe("getEServiceEvents integration", () => {
  const events: m2mEventApi.EServiceM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "ESERVICE_ADDED",
      eserviceId: generateId(),
      producerDelegationId: generateId(),
    },
  ];
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

  it.each([
    { lastEventId: generateId(), delegationId: generateId() },
    { lastEventId: generateId(), delegationId: undefined },
    { lastEventId: generateId(), delegationId: generateId() },
    { lastEventId: undefined, delegationId: undefined },
  ])(
    "Should succeed and perform API clients calls",
    async ({ lastEventId, delegationId }) => {
      const expectedResponse: m2mGatewayApiV3.EServiceEvents = {
        events,
      };
      const result = await eventService.getEServiceEvents(
        {
          lastEventId,
          delegationId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetEServiceM2MEvents,
        queries: {
          lastEventId,
          delegationId,
          limit: 10,
        },
      });
    }
  );
});
