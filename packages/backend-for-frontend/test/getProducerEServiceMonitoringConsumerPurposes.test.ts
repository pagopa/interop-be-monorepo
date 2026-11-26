import { bffApi, purposeApi } from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { producerDashboardServiceBuilder } from "../src/services/producerDashboardService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("getProducerEServiceMonitoringConsumerPurposes", () => {
  const processResponse: purposeApi.ProducerEServiceMonitoringConsumerPurposes =
    {
      eservice: { id: generateId(), name: "Anagrafe" },
      version: "3",
      consumer: { id: generateId(), name: "Comune di Roma", kind: "PA" },
      dailyCallsPerConsumer: 2000,
      customizedByAttribute: {
        id: generateId(),
        name: "Comuni",
        kind: "CERTIFIED_DISCRETE",
      },
      approvedDailyCalls: 600,
      percentage: 30,
      waitingForApprovalPurposes: 2,
      results: [
        {
          purposeId: generateId(),
          title: "Cambio stima",
          dailyCalls: 600,
          state: "SUSPENDED",
          suspendedByConsumer: true,
          suspendedByProducer: false,
          updatedAt: new Date().toISOString(),
          hasPendingQuotaChange: true,
        },
        {
          purposeId: generateId(),
          title: "Nuova",
          dailyCalls: 300,
          state: "WAITING_FOR_APPROVAL",
          updatedAt: new Date().toISOString(),
          hasPendingQuotaChange: false,
        },
      ],
      pagination: { offset: 5, limit: 5, totalCount: 7 },
    };
  const mockGetProducerEServiceMonitoringConsumerPurposes = vi.fn();
  const service = producerDashboardServiceBuilder({
    purposeProcessClient: {
      getProducerEServiceMonitoringConsumerPurposes:
        mockGetProducerEServiceMonitoringConsumerPurposes,
    },
  } as unknown as PagoPAInteropBeClients);
  const ctx = getMockContext({}) as unknown as Parameters<
    typeof service.getProducerEServiceMonitoringConsumerPurposes
  >[4] &
    BffAppContext;

  beforeEach(() => {
    mockGetProducerEServiceMonitoringConsumerPurposes.mockResolvedValue(
      processResponse
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes path and query parameters unchanged and converts the response", async () => {
    const eserviceId = generateId();
    const descriptorId = generateId();
    const consumerId = generateId();
    const queries = {
      offset: 5,
      limit: 5,
      q: "Finalità",
      sortBy: "DATE_ASC" as bffApi.DateNameSortBy,
      states: ["ACTIVE", "SUSPENDED"] as bffApi.PurposeVersionState[],
      includeArchived: true,
    };

    const result = await service.getProducerEServiceMonitoringConsumerPurposes(
      eserviceId,
      descriptorId,
      consumerId,
      queries,
      ctx
    );

    expect(
      mockGetProducerEServiceMonitoringConsumerPurposes
    ).toHaveBeenCalledWith({
      params: { eserviceId, descriptorId, consumerId },
      queries,
      headers: ctx.headers,
    });
    expect(result).toEqual(processResponse);
  });

  it("converts the empty response of a consumer without relationship", async () => {
    const emptyResponse: purposeApi.ProducerEServiceMonitoringConsumerPurposes =
      {
        eservice: processResponse.eservice,
        version: processResponse.version,
        dailyCallsPerConsumer: 1000,
        approvedDailyCalls: 0,
        percentage: 0,
        waitingForApprovalPurposes: 0,
        results: [],
        pagination: { offset: 0, limit: 10, totalCount: 0 },
      };
    mockGetProducerEServiceMonitoringConsumerPurposes.mockResolvedValue(
      emptyResponse
    );

    const result = await service.getProducerEServiceMonitoringConsumerPurposes(
      generateId(),
      generateId(),
      generateId(),
      { offset: 0, limit: 10 },
      ctx
    );

    expect(
      bffApi.ProducerEServiceMonitoringConsumerPurposes.parse(result)
    ).toEqual(emptyResponse);
  });
});
