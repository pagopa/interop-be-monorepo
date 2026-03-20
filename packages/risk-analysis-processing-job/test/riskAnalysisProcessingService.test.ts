import { catalogApi } from "pagopa-interop-api-clients";
import { genericLogger, RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  describe,
  beforeAll,
  beforeEach,
  vi,
  afterEach,
  it,
  expect,
} from "vitest";

import { getInteropBeClients } from "../src/clients/clientsProvider.js";
import { riskAnalysisProcessingServiceBuilder } from "../src/services/riskAnalysisProcessingService.js";
import {
  addOneEService,
  mockRiskAnalysisWithoutTenantKind,
  readModelService,
} from "./utils.js";
import { getMockEService } from "pagopa-interop-commons-test";

describe("riskAnalysisProcessingService", () => {
  const testCorrelationId: CorrelationId = generateId();
  const testToken = "mockToken";

  let catalogProcessClient: catalogApi.CatalogProcessClient;
  let mockRefreshableToken: RefreshableInteropToken;

  type MockedFixEServiceRiskAnalysisTenantKind = {
    mock: {
      calls: Parameters<
        typeof catalogProcessClient.fixEServiceRiskAnalysisTenantKind
      >[];
    };
  };

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;

    catalogProcessClient = getInteropBeClients().catalogProcess.client;
  });

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    catalogProcessClient.fixEServiceRiskAnalysisTenantKind = vi.fn();
    //TODO: catalogProcessClient.fixPurposeRiskAnalysisTenantKind = vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("calls fix endpoint for each eservice risk analysis", async () => {
    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      catalogProcessClient,
      mockRefreshableToken,
      genericLogger,
      testCorrelationId
    );

    const testEservices = [
      {
        ...getMockEService(),
        riskAnalysis: [
          mockRiskAnalysisWithoutTenantKind(),
          mockRiskAnalysisWithoutTenantKind(),
        ],
      },
      {
        ...getMockEService(),
        riskAnalysis: [
          mockRiskAnalysisWithoutTenantKind(),
          mockRiskAnalysisWithoutTenantKind(),
        ],
      },
    ];

    const RAids = testEservices.flatMap((e) =>
      e.riskAnalysis.flatMap((ra) => ({ riskAnalysis: ra.id, eService: e.id }))
    );

    for (const eservice of testEservices) {
      await addOneEService(eservice);
    }

    await riskAnalysisProcessingService.processEServiceRiskAnalyses();

    expect(
      catalogProcessClient.fixEServiceRiskAnalysisTenantKind
    ).toHaveBeenCalledTimes(RAids.length);

    (
      catalogProcessClient.fixEServiceRiskAnalysisTenantKind as unknown as MockedFixEServiceRiskAnalysisTenantKind
    ).mock.calls.forEach((call) => {
      expect(
        RAids.some(
          (couple) =>
            // [0]body, [1]params
            couple.eService === call[1].params.eServiceId &&
            couple.riskAnalysis === call[1].params.riskAnalysisId
        )
      ).toBeTruthy();
    });
  });
});
