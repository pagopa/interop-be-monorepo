import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEServiceTemplateEvent,
} from "../../mockUtils.js";

describe("getEServiceTemplateEvents integration", () => {
  const events: m2mEventApi.EServiceTemplateM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "ESERVICE_TEMPLATE_ADDED",
      eserviceTemplateId: generateId(),
    },
  ];

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
        events: events.map(testToM2mGatewayApiEServiceTemplateEvent),
      };
      const result = await eventService.getEServiceTemplateEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
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
