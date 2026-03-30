import {
  getMockEService,
  getMockEServiceTemplate,
  getMockPurpose,
  getMockValidRiskAnalysis,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  EService,
  EServiceTemplate,
  generateId,
  Purpose,
  PurposeRiskAnalysisForm,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOnePurpose,
  readModelService,
} from "./utils.js";

describe("eservice templates", () => {
  it("gets only the requested eservice templates RAs", async () => {
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
      {
        ...getMockEServiceTemplate(),
        riskAnalysis: [
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
          getMockValidRiskAnalysis(tenantKind.PRIVATE),
        ],
      },
    ];

    const eserviceTemplatesToProcess = newEServiceTemplates.slice(0, -1);
    const idsToCheck = [];
    for (const eTemplate of eserviceTemplatesToProcess) {
      for (const ra of eTemplate.riskAnalysis) {
        idsToCheck.push(ra.id);
      }
      await addOneEServiceTemplate(eTemplate);
    }

    const ids = eserviceTemplatesToProcess.map((t) => t.id);

    const eserviceTemplates =
      await readModelService.getReadModelEServiceTemplates(ids);

    const actualRAIds = eserviceTemplates
      .flatMap((e) => e.riskAnalysis)
      .map((r) => r.id);

    expect(eserviceTemplates).toHaveLength(eserviceTemplatesToProcess.length);
    expect(actualRAIds).toHaveLength(idsToCheck.length);
    idsToCheck.forEach((id) => {
      expect(actualRAIds).toContain(id);
    });
  });
});

describe("eservices", () => {
  it("gets all eservice RAs with empty tenant kinds", async () => {
    const riskAnalysisWithoutTenantKind = getMockValidRiskAnalysis(
      tenantKind.PA
    );
    delete riskAnalysisWithoutTenantKind.riskAnalysisForm.tenantKind;

    const mockEService: EService = {
      ...getMockEService(),
      riskAnalysis: [riskAnalysisWithoutTenantKind],
    };

    await addOneEService(mockEService);

    const safeRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);

    const mockEService2: EService = {
      ...getMockEService(),
      riskAnalysis: [safeRiskAnalysis],
    };

    await addOneEService(mockEService2);

    const RAs =
      await readModelService.getAllReadModelEServicesWithEmptyTenantKindRAs();

    expect(RAs).toHaveLength(1);
  });

  it("populate riskAnalysis array only with RAs without tenant kinds", async () => {
    const riskAnalysisWithoutTenantKind = getMockValidRiskAnalysis(
      tenantKind.PA
    );
    delete riskAnalysisWithoutTenantKind.riskAnalysisForm.tenantKind;
    const safeRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);

    const mockEService: EService = {
      ...getMockEService(),
      riskAnalysis: [riskAnalysisWithoutTenantKind, safeRiskAnalysis],
    };

    await addOneEService(mockEService);

    const RAs =
      await readModelService.getAllReadModelEServicesWithEmptyTenantKindRAs();

    expect(RAs).toHaveLength(1);
    expect(RAs[0].riskAnalysis).toHaveLength(1);
  });
});

describe("purposes", () => {
  it("gets all purpose RAs with empty tenant kinds", async () => {
    const purposeRiskAnalysisFormWithoutTK: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    delete purposeRiskAnalysisFormWithoutTK.tenantKind;

    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      riskAnalysisForm: purposeRiskAnalysisFormWithoutTK,
    };

    await addOnePurpose(mockPurpose);

    const safeRiskAnalysis: PurposeRiskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PA),
      riskAnalysisId: generateId<RiskAnalysisId>(),
    };

    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      riskAnalysisForm: safeRiskAnalysis,
    };

    await addOnePurpose(mockPurpose2);

    const RAs =
      await readModelService.getAllReadModelPurposesWithoutTenantKind();

    expect(RAs).toHaveLength(1);
  });
});
