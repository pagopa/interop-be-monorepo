import { bffApi, purposeApi } from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { producerDashboardServiceBuilder } from "../src/services/producerDashboardService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("getProducerEServiceMonitoringSaturation", () => {
  const processResponse: purposeApi.ProducerEServiceMonitoringSaturation = {
    eservice: { id: generateId(), name: "Anagrafe" },
    version: "3",
    otherVersions: [{ descriptorId: generateId(), version: "2" }],
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
    customizedQuotaConsumers: 4,
    activeConsumers: 25,
    results: [
      {
        consumer: { id: generateId(), name: "Comune di Roma", kind: "PA" },
        activePurposesCount: 2,
        approvedDailyCalls: 900,
        dailyCallsPerConsumer: 1000,
        percentage: 90,
        waitingForApprovalDailyCalls: 500,
      },
    ],
    pagination: { offset: 5, limit: 5, totalCount: 25 },
  };
  const mockGetProducerEServiceMonitoringSaturation = vi.fn();
  const service = producerDashboardServiceBuilder({
    purposeProcessClient: {
      getProducerEServiceMonitoringSaturation:
        mockGetProducerEServiceMonitoringSaturation,
    },
  } as unknown as PagoPAInteropBeClients);
  const ctx = getMockContext({}) as unknown as Parameters<
    typeof service.getProducerEServiceMonitoringSaturation
  >[3] &
    BffAppContext;

  beforeEach(() => {
    mockGetProducerEServiceMonitoringSaturation.mockResolvedValue(
      processResponse
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes path and query parameters unchanged and converts the response", async () => {
    const eserviceId = generateId();
    const descriptorId = generateId();
    const queries = {
      offset: 5,
      limit: 5,
      q: "Comune",
      sortBy: "PERCENTAGE_DESC" as bffApi.SaturationSortBy,
    };

    const result = await service.getProducerEServiceMonitoringSaturation(
      eserviceId,
      descriptorId,
      queries,
      ctx
    );

    expect(mockGetProducerEServiceMonitoringSaturation).toHaveBeenCalledWith({
      params: { eserviceId, descriptorId },
      queries,
      headers: ctx.headers,
    });
    expect(result).toEqual(processResponse);
  });
});
