import {
  getMockEService,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { EService, tenantKind } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { addOneEService, readModelService } from "./utils.js";

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
});
