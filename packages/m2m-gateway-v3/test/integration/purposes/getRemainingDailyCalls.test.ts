import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, PurposeId } from "pagopa-interop-models";
import {
  purposeService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("getRemainingDailyCalls", () => {
  const mockPurposeId: PurposeId = generateId();
  const mockRemainingDailyCallsResponse: m2mGatewayApiV3.RemainingDailyCallsResponse =
    {
      remainingDailyCallsPerConsumer: 80,
      remainingDailyCallsTotal: 1800,
    };

  beforeEach(() => {
    vi.clearAllMocks();

    mockInteropBeClients.purposeProcessClient = {
      getRemainingDailyCalls: vi
        .fn()
        .mockResolvedValue({ data: mockRemainingDailyCallsResponse }),
    } as unknown as PagoPAInteropBeClients["purposeProcessClient"];
  });

  it("Should succeed and perform API client call", async () => {
    const result = await purposeService.getRemainingDailyCalls(
      mockPurposeId,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockRemainingDailyCallsResponse);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getRemainingDailyCalls,
      params: { purposeId: mockPurposeId },
    });
  });
});
