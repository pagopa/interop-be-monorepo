import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, m2mEventApi } from "pagopa-interop-api-clients";
import { generateId, TenantM2MEventType } from "pagopa-interop-models";
import {
  eventService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getTenantEvents integration", () => {
  const eventTypes = TenantM2MEventType.options;
  const events: m2mGatewayApi.TenantEvent[] = eventTypes.map((eventType) => ({
    id: generateId(),
    eventTimestamp: new Date().toJSON(),
    eventType: eventType as m2mGatewayApi.TenantEvent["eventType"],
    tenantId: generateId(),
  }));

  const mockEventManagerResponse: m2mEventApi.TenantM2MEvents = {
    events,
  };

  const mockGetTenantM2MEvents = vi
    .fn()
    .mockResolvedValue(mockEventManagerResponse);

  mockInteropBeClients.eventManagerClient = {
    getTenantM2MEvents: mockGetTenantM2MEvents,
  } as unknown as PagoPAInteropBeClients["eventManagerClient"];

  beforeEach(() => {
    mockGetTenantM2MEvents.mockClear();
  });

  it.each([generateId(), undefined])(
    "Should succeed and perform API clients calls",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.TenantEvents = {
        events,
      };
      const result = await eventService.getTenantEvents(
        {
          lastEventId,
          limit: 10,
        },
        getMockM2MAdminAppContext()
      );
      expect(result).toEqual(expectedResponse);
      expectApiClientGetToHaveBeenCalledWith({
        mockGet: mockGetTenantM2MEvents,
        queries: {
          lastEventId,
          limit: 10,
        },
      });
    }
  );
});
