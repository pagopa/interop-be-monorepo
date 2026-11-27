import { bffApi, purposeApi } from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { producerDashboardServiceBuilder } from "../src/services/producerDashboardService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("getProducerDashboardSaturation", () => {
  const processResponse: purposeApi.ProducerDashboardSaturation = {
    summary: { overThreshold: 1, nearThreshold: 2, total: 3 },
    results: [
      {
        eservice: { id: generateId(), name: "Anagrafe" },
        descriptorId: generateId(),
        version: "3",
        activePurposesCount: 12,
        approvedDailyCalls: 9500,
        dailyCallsTotal: 10000,
        percentage: 95,
        waitingForApprovalDailyCalls: 2000,
      },
    ],
    pagination: { offset: 5, limit: 5, totalCount: 3 },
  };
  const mockGetProducerDashboardSaturation = vi.fn();
  const service = producerDashboardServiceBuilder({
    purposeProcessClient: {
      getProducerDashboardSaturation: mockGetProducerDashboardSaturation,
    },
  } as unknown as PagoPAInteropBeClients);
  const ctx = getMockContext({}) as unknown as Parameters<
    typeof service.getProducerDashboardSaturation
  >[1] &
    BffAppContext;

  beforeEach(() => {
    mockGetProducerDashboardSaturation.mockResolvedValue(processResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should pass the parameters unchanged and convert the response", async () => {
    const queries = {
      offset: 5,
      limit: 5,
      q: "ana",
      sortBy: "PERCENTAGE_ASC" as bffApi.SaturationSortBy,
    };

    const result = await service.getProducerDashboardSaturation(queries, ctx);

    expect(mockGetProducerDashboardSaturation).toHaveBeenCalledWith({
      queries,
      headers: ctx.headers,
    });
    expect(result).toEqual(processResponse);
  });
});
