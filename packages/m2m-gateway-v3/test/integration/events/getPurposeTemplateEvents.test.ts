import { m2mGatewayApiV3, m2mEventApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
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

  it.each([
    "PURPOSE_TEMPLATE_PURPOSE_TITLE_UPDATED",
    "PURPOSE_TEMPLATE_PURPOSE_DESCRIPTION_UPDATED",
    "PURPOSE_TEMPLATE_TARGET_DESCRIPTION_UPDATED",
  ] as const)("Should expose the metadata event %s", async (eventType) => {
    const event: m2mEventApi.PurposeTemplateM2MEvent = {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      purposeTemplateId: generateId(),
      eventType,
    };
    mockGetPurposeTemplateM2MEvents.mockResolvedValueOnce({ events: [event] });

    const result = await eventService.getPurposeTemplateEvents(
      { limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(m2mGatewayApiV3.PurposeTemplateEvents.parse(result)).toEqual({
      events: [event],
    });
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
