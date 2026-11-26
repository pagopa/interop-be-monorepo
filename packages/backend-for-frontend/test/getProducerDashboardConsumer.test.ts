import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import { featureFlagNotEnabled, generateId } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { producerDashboardServiceBuilder } from "../src/services/producerDashboardService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("getProducerDashboardConsumer", () => {
  const consumerId = generateId();
  const processResponse: catalogApi.ProducerDashboardConsumer = {
    consumer: { id: consumerId, name: "Comune di Roma", kind: "PA" },
    eservicesCount: 3,
    results: [
      {
        eservice: { id: generateId(), name: "Anagrafe" },
        descriptorId: generateId(),
        version: "2",
        agreement: { id: generateId(), state: "SUSPENDED" },
        activePurposesCount: 2,
        approvedDailyCalls: 3000,
      },
    ],
    pagination: { offset: 5, limit: 5, totalCount: 1 },
  };
  const mockGetProducerDashboardConsumer = vi.fn();
  const service = producerDashboardServiceBuilder({
    catalogProcessClient: {
      getProducerDashboardConsumer: mockGetProducerDashboardConsumer,
    },
  } as unknown as PagoPAInteropBeClients);
  const ctx = getMockContext({}) as unknown as Parameters<
    typeof service.getProducerDashboardConsumer
  >[2] &
    BffAppContext;

  beforeEach(() => {
    config.featureFlagProducerDashboard = true;
    mockGetProducerDashboardConsumer.mockResolvedValue(processResponse);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
    vi.clearAllMocks();
  });

  it("should pass the parameters unchanged and convert the response", async () => {
    const queries = {
      offset: 5,
      limit: 5,
      q: "ana",
      sortBy: "DAILY_CALLS_DESC" as bffApi.ConsumerEServicesSortBy,
    };

    const result = await service.getProducerDashboardConsumer(
      consumerId,
      queries,
      ctx
    );

    expect(mockGetProducerDashboardConsumer).toHaveBeenCalledWith({
      params: { consumerId },
      queries,
      headers: ctx.headers,
    });
    expect(result).toEqual(processResponse);
  });

  it("should convert a response without consumer", async () => {
    const emptyResponse: catalogApi.ProducerDashboardConsumer = {
      eservicesCount: 0,
      results: [],
      pagination: { offset: 0, limit: 10, totalCount: 0 },
    };
    mockGetProducerDashboardConsumer.mockResolvedValue(emptyResponse);

    const result = await service.getProducerDashboardConsumer(
      consumerId,
      { offset: 0, limit: 10 },
      ctx
    );

    expect(result).toEqual(emptyResponse);
    expect(result.consumer).toBeUndefined();
  });

  it("should throw featureFlagNotEnabled when the feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;

    await expect(
      service.getProducerDashboardConsumer(
        consumerId,
        { offset: 0, limit: 10 },
        ctx
      )
    ).rejects.toThrowError(
      featureFlagNotEnabled("featureFlagProducerDashboard")
    );
    expect(mockGetProducerDashboardConsumer).not.toHaveBeenCalled();
  });
});
