import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  attributeService,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateCertifiedAttributesSubunitPropagation", () => {
  const mockUpdateAttributesSubunitPropagation = vi.fn();

  mockInteropBeClients.attributeProcessClient = {
    updateAttributesSubunitPropagation: mockUpdateAttributesSubunitPropagation,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockUpdateAttributesSubunitPropagation.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const seed: m2mGatewayApiV3.AttributeSubunitPropagationUpdateSeed = {
      attributeIds: [generateId()],
    };

    const result =
      await attributeService.updateCertifiedAttributesSubunitPropagation(
        seed,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(undefined);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.attributeProcessClient
          .updateAttributesSubunitPropagation,
      body: seed,
    });
  });
});
