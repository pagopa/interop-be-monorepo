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

describe("getPurposeTemplateEvents integration", () => {
  const events: m2mGatewayApiV3.PurposeTemplateEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "PURPOSE_TEMPLATE_ADDED",
      purposeTemplateId: generateId(),
    },
  ];

  const mockEventManagerResponse: m2mEventApi.PurposeTemplateM2MEvents = {
    events,
  };

  const mockGetPurposeTemplateM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getPurposeTemplateM2MEvents: mockGetPurposeTemplateM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetPurposeTemplateM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApiV3.PurposeTemplateEvents = {
        events,
      };
      const result = await eventService.getPurposeTemplateEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetPurposeTemplateM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
