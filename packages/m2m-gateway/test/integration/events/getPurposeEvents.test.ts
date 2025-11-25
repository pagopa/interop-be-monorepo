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

describe("getPurposeEvents integration", () => {
  const events: m2mGatewayApi.PurposeEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PURPOSE_ADDED",
      purposeId: generateId(),
      purposeVersionId: generateId(),
      producerDelegationId: generateId(),
      consumerDelegationId: generateId(),
    },
  ];

  const mockEventManagerResponse: m2mEventApi.PurposeM2MEvents = {
    events,
  };

  const mockGetPurposeM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getPurposeM2MEvents: mockGetPurposeM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetPurposeM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.PurposeEvents = {
        events,
      };
      const result = await eventService.getPurposeEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetPurposeM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
