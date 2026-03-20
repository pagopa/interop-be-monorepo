import { catalogApi, purposeApi } from "pagopa-interop-api-clients";
import { RefreshableInteropToken } from "pagopa-interop-commons";
import { CorrelationId, generateId, Purpose } from "pagopa-interop-models";
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
  addOnePurpose,
  mockRiskAnalysisFormWithoutTenantKind,
  mockRiskAnalysisWithoutTenantKind,
  readModelService,
} from "./utils.js";
import { getMockEService, getMockPurpose } from "pagopa-interop-commons-test";

describe("riskAnalysisProcessingService", () => {
  const testCorrelationId: CorrelationId = generateId();
  const testToken = "mockToken";

  let catalogProcessClient: catalogApi.CatalogProcessClient;
  let purposeProcessClient: purposeApi.PurposeProcessClient;
  let mockRefreshableToken: RefreshableInteropToken;

  type MockedFixEServiceRiskAnalysisTenantKind = {
    mock: {
      calls: Parameters<
        typeof catalogProcessClient.fixEServiceRiskAnalysisTenantKind
      >[];
    };
  };

  type MockedFixPurposeRiskAnalysisTenantKind = {
    mock: {
      calls: Parameters<
        typeof purposeProcessClient.fixPurposeRiskAnalysisTenantKind
      >[];
    };
  };

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;

    const clients = getInteropBeClients();

    catalogProcessClient = clients.catalogProcess.client;
    purposeProcessClient = clients.purposeProcess.client;
  });

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    catalogProcessClient.fixEServiceRiskAnalysisTenantKind = vi.fn();
    purposeProcessClient.fixPurposeRiskAnalysisTenantKind = vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("calls fix endpoint for each eservice risk analysis", async () => {
    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      catalogProcessClient,
      purposeProcessClient,
      mockRefreshableToken,
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

  it("calls fix endpoint for each purpose risk analysis", async () => {
    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      catalogProcessClient,
      purposeProcessClient,
      mockRefreshableToken,
      testCorrelationId
    );

    const testPurposes: Purpose[] = [
      {
        ...getMockPurpose(),
        riskAnalysisForm: mockRiskAnalysisFormWithoutTenantKind(),
      },
      {
        ...getMockPurpose(),
        riskAnalysisForm: mockRiskAnalysisFormWithoutTenantKind(),
      },
    ];

    const RAids = testPurposes.flatMap((p) => ({
      riskAnalysis: p.riskAnalysisForm!.id,
      purpose: p.id,
    }));

    for (const purpose of testPurposes) {
      await addOnePurpose(purpose);
    }

    await riskAnalysisProcessingService.processPurposeRiskAnalyses();

    expect(
      purposeProcessClient.fixPurposeRiskAnalysisTenantKind
    ).toHaveBeenCalledTimes(RAids.length);

    (
      purposeProcessClient.fixPurposeRiskAnalysisTenantKind as unknown as MockedFixPurposeRiskAnalysisTenantKind
    ).mock.calls.forEach((call) => {
      expect(
        RAids.some(
          (couple) =>
            // [0]body, [1]params
            couple.purpose === call[1].params.purposeId &&
            couple.riskAnalysis === call[1].params.riskAnalysisId
        )
      ).toBeTruthy();
    });
  });
});
