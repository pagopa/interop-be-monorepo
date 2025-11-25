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
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("getAgreementEvents integration", () => {
  const eventTypes = AgreementM2MEventType.options;
  const events: m2mEventApi.AgreementM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        agreementId: generateId(),
        producerDelegationId: generateId(),
        consumerDelegationId: generateId(),
      } as m2mEventApi.AgreementM2MEvent)
  );

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

  it.each([
    { lastEventId: generateId(), delegationId: generateId() },
    { lastEventId: generateId(), delegationId: undefined },
    { lastEventId: generateId(), delegationId: generateId() },
    { lastEventId: undefined, delegationId: undefined },
  ])(
    "Should succeed and perform API clients calls",
    async ({ lastEventId, delegationId }) => {
      const expectedResponse: m2mGatewayApi.AgreementEvents = {
        events,
      };
      const result = await eventService.getAgreementEvents(
        {
          lastEventId,
          delegationId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetAgreementM2MEvents,
        queries: {
          lastEventId,
          delegationId,
          limit: 10,
        },
      });
    }
  );
});
