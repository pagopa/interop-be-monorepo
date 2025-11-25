import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateM2MEventType,
  generateId,
} from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";

describe("getEServiceTemplateEvents integration", () => {
  const eventTypes = EServiceTemplateM2MEventType.options;
  const events: m2mEventApi.EServiceTemplateM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        eserviceTemplateId: generateId(),
      } as m2mEventApi.EServiceTemplateM2MEvent)
  );

  const mockEventManagerResponse: m2mEventApi.EServiceTemplateM2MEvents = {
    events,
  };

  const mockGetEServiceTemplateM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getEServiceTemplateM2MEvents: mockGetEServiceTemplateM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetEServiceTemplateM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.EServiceTemplateEvents = {
        events,
      };
      const result = await eventService.getEServiceTemplateEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetEServiceTemplateM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
