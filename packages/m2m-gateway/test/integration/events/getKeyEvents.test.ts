import { describe, it, expect, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { eventService } from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getKeyEvents integration", () => {
  const mockKeyEvents: m2mGatewayApi.KeyEvents = {
    events: [],
  };

  beforeEach(() => {
    // Mock cleanup if needed
  });

  it.each([generateId(), undefined])(
    "Should succeed and return empty events array",
    async (lastEventId) => {
      const expectedResponse: m2mGatewayApi.KeyEvents = mockKeyEvents;
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
