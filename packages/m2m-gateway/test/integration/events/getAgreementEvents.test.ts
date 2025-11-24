import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { AgreementM2MEventType, generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getAgreementEvents integration", () => {
  const eventTypes = AgreementM2MEventType.options;
  const events: m2mGatewayApi.AgreementEvent[] = eventTypes.map((eventType) => ({
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: eventType as m2mGatewayApi.AgreementEvent["eventType"],
    agreementId: generateId(),
  }));

  const mockEventManagerResponse: m2mEventApi.AgreementM2MEvents = {
    events,
  };

  const mockGetAgreementM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getAgreementM2MEvents: mockGetAgreementM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetAgreementM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.AgreementEvents = {
        events,
      };
      const result = await eventService.getAgreementEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetAgreementM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
