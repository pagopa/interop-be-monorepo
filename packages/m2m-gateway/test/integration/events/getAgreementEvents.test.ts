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

describe("getAgreementEvents integration", () => {
  const mockAgreementEvent1: m2mEventApi.AgreementM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "AGREEMENT_ADDED",
    agreementId: generateId(),
  };

  const mockAgreementEvent2: m2mEventApi.AgreementM2MEvent = {
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: "DRAFT_AGREEMENT_UPDATED",
    agreementId: generateId(),
  };

  const mockEventManagerResponse: m2mEventApi.AgreementM2MEvents = {
    events: [mockAgreementEvent1, mockAgreementEvent2],
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
        events: [mockAgreementEvent1, mockAgreementEvent2],
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
