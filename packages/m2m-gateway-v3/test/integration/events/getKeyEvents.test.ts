import { describe, it, expect, beforeEach, vi } from "vitest";
import { m2mEventApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { eventService, mockInteropBeClients } from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getKeyEvents integration", () => {
  const events: m2mEventApi.KeyM2MEvent[] = [
    {
      id: generateId(),
      eventTimestamp: new Date().toJSON(),
      eventType: "CLIENT_KEY_ADDED",
      clientId: generateId(),
      kid: generateId(),
    },
  ];

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
      const expectedResponse: m2mGatewayApiV3.KeyEvents = {
        events,
      };
      const result = await eventService.getKeyEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toStrictEqual(expectedResponse);
    }
  );
});
