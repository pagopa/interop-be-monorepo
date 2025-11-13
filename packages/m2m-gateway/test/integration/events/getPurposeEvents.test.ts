import { describe, it, expect, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { eventService } from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getPurposeEvents integration", () => {
  const mockPurposeEvents: m2mGatewayApi.PurposeEvents = {
    events: [],
  };

  beforeEach(() => {
    // Mock cleanup if needed
  });

  it.each([generateId(), undefined])(
    "Should succeed and return empty events array",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.PurposeEvents = mockPurposeEvents;
      const result = await eventService.getPurposeEvents(
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
