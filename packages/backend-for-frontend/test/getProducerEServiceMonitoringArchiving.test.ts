import { catalogApi } from "pagopa-interop-api-clients";
import { getMockContext } from "pagopa-interop-commons-test";
import {
  EServiceId,
  featureFlagNotEnabled,
  generateId,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { producerDashboardServiceBuilder } from "../src/services/producerDashboardService.js";
import { BffAppContext } from "../src/utilities/context.js";

describe("getProducerEServiceMonitoringArchiving", () => {
  const eserviceId = generateId<EServiceId>();
  const processResponse: catalogApi.MonitoringArchiving = {
    results: [
      {
        eservice: { id: eserviceId, name: "Anagrafe" },
        descriptorId: generateId(),
        version: "2",
        consumersCount: 4,
        archivableOn: new Date().toJSON(),
      },
      {
        eservice: { id: eserviceId, name: "Anagrafe" },
        consumersCount: 1,
        archivableOn: new Date().toJSON(),
      },
    ],
    pagination: { offset: 0, limit: 10, totalCount: 2 },
  };
  const mockGetProducerEServiceMonitoringArchiving = vi.fn();
  const service = producerDashboardServiceBuilder({
    catalogProcessClient: {
      getProducerEServiceMonitoringArchiving:
        mockGetProducerEServiceMonitoringArchiving,
    },
  } as unknown as PagoPAInteropBeClients);
  const ctx = getMockContext({}) as unknown as Parameters<
    typeof service.getProducerEServiceMonitoringArchiving
  >[2] &
    BffAppContext;

  beforeEach(() => {
    config.featureFlagProducerDashboard = true;
    mockGetProducerEServiceMonitoringArchiving.mockResolvedValue(
      processResponse
    );
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
    vi.clearAllMocks();
  });

  it("should pass the parameters unchanged and convert the response", async () => {
    const queries = { offset: 0, limit: 10 };

    const result = await service.getProducerEServiceMonitoringArchiving(
      eserviceId,
      queries,
      ctx
    );

    expect(mockGetProducerEServiceMonitoringArchiving).toHaveBeenCalledWith({
      params: { eserviceId },
      queries,
      headers: ctx.headers,
    });
    expect(result).toEqual(processResponse);
  });

  it("should throw featureFlagNotEnabled when the feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;

    await expect(
      service.getProducerEServiceMonitoringArchiving(
        eserviceId,
        { offset: 0, limit: 10 },
        ctx
      )
    ).rejects.toEqual(featureFlagNotEnabled("featureFlagProducerDashboard"));
    expect(mockGetProducerEServiceMonitoringArchiving).not.toHaveBeenCalled();
  });
});
