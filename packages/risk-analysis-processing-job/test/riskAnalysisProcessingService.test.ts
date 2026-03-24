import {
  catalogApi,
  eserviceTemplateApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { RefreshableInteropToken } from "pagopa-interop-commons";
import {
  CorrelationId,
  EServiceTemplate,
  generateId,
  Purpose,
  tenantKind,
} from "pagopa-interop-models";
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
  addOneEServiceTemplate,
  addOnePurpose,
  mockRiskAnalysisFormWithoutTenantKind,
  mockRiskAnalysisWithoutTenantKind,
  readModelService,
} from "./utils.js";
import {
  getMockEService,
  getMockEServiceTemplate,
  getMockPurpose,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";

describe("riskAnalysisProcessingService", () => {
  const testCorrelationId: CorrelationId = generateId();
  const testToken = "mockToken";

  let catalogProcessClient: catalogApi.CatalogProcessClient;
  let purposeProcessClient: purposeApi.PurposeProcessClient;
  let eserviceTemplateProcessClient: eserviceTemplateApi.EServiceTemplateProcessClient;

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

  type MockedFixEServiceTemplateRiskAnalysisTenantKind = {
    mock: {
      calls: Parameters<
        typeof eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind
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
    eserviceTemplateProcessClient = clients.eserviceTemplateProcess.client;
  });

  beforeEach(async () => {
    catalogProcessClient.fixEServiceRiskAnalysisTenantKind = vi.fn();
    purposeProcessClient.fixPurposeRiskAnalysisTenantKind = vi.fn();
    eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind =
      vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("calls fix endpoint for each eservice risk analysis", async () => {
    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      catalogProcessClient,
      purposeProcessClient,
      eserviceTemplateProcessClient,
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
      eserviceTemplateProcessClient,
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

  it("calls fix endpoint for each eservice template risk analysis", async () => {
    const riskAnalysisProcessingService = riskAnalysisProcessingServiceBuilder(
      readModelService,
      catalogProcessClient,
      purposeProcessClient,
      eserviceTemplateProcessClient,
      mockRefreshableToken,
      testCorrelationId
    );

    const newEServiceTemplates: EServiceTemplate[] = [
      {
        ...getMockEServiceTemplate(),
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PA),
          getMockValidRiskAnalysis(tenantKind.PA),
        ],
      },
      {
        ...getMockEServiceTemplate(),
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
      },
    ];

    const idsToCheck: { eServiceTemplate: string; riskAnalysis: string }[] = [];
    for (const eTemplate of newEServiceTemplates) {
      for (const ra of eTemplate.riskAnalysis) {
        idsToCheck.push({
          eServiceTemplate: eTemplate.id,
          riskAnalysis: ra.id,
        });
      }
      await addOneEServiceTemplate(eTemplate);
    }

    await riskAnalysisProcessingService.processEServiceTemplateRiskAnalyses();

    expect(
      eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind
    ).toHaveBeenCalledTimes(idsToCheck.length);

    (
      eserviceTemplateProcessClient.fixEServiceTemplateRiskAnalysisTenantKind as unknown as MockedFixEServiceTemplateRiskAnalysisTenantKind
    ).mock.calls.forEach((call) => {
      expect(
        idsToCheck.some(
          (couple) =>
            // [0]body, [1]params
            couple.eServiceTemplate === call[1].params.templateId &&
            couple.riskAnalysis === call[1].params.riskAnalysisId
        )
      ).toBeTruthy();
    });
  });
});
