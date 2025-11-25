import { describe, it, expect, beforeEach, vi } from "vitest";
import { m2mEventApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { KeyM2MEventType, generateId } from "pagopa-interop-models";
import { eventService, mockInteropBeClients } from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { testToUpperSnakeCase } from "../../multipartTestUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getKeyEvents integration", () => {
  const eventTypes = KeyM2MEventType.options;
  const events: m2mEventApi.KeyM2MEvent[] = eventTypes.map(
    (eventType) =>
      ({
        id: generateId(),
        eventTimestamp: new Date().toJSON(),
        eventType: testToUpperSnakeCase(eventType),
        clientId: generateId(),
        kid: generateId(),
      } as m2mEventApi.KeyM2MEvent)
  );
  const mockEventManagerResponse: m2mEventApi.KeyM2MEvents = {
    events,
  };
  const mockGetKeyM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getKeyM2MEvents: mockGetKeyM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetKeyM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and return empty events array",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.KeyEvents = {
        events,
      };
      const result = await eventService.getKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
    }
  );
});
