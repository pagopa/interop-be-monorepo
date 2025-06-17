/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import { tenantKind } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getFormRulesByVersion } from "pagopa-interop-commons";
import { riskAnalysisConfigVersionNotFound } from "../../src/model/domain/errors.js";
import { purposeService } from "../integrationUtils.js";

describe("retrieveRiskAnalysisConfigurationByVersion", async () => {
  it("should retrieve risk analysis configuration by version (Eservice mode: deliver)", async () => {
    const kind = randomArrayItem(Object.values(tenantKind));
    const riskAnalysisVersion = "1.0";

    const result =
      await purposeService.retrieveRiskAnalysisConfigurationByVersion({
        tenantKind: kind,
        riskAnalysisVersion,
        ctx: getMockContext({ authData: getMockAuthData() }),
      });

    expect(result).toEqual(getFormRulesByVersion(kind, riskAnalysisVersion));
  });
  it("should throw RiskAnalysisConfigVersionNotFound if a config with that version doesn't exist", async () => {
    const wrongRiskAnalysisVersion = "9.0";

    expect(
      purposeService.retrieveRiskAnalysisConfigurationByVersion({
        tenantKind: tenantKind.PA,
        riskAnalysisVersion: wrongRiskAnalysisVersion,
        ctx: getMockContext({ authData: getMockAuthData() }),
      })
    ).rejects.toThrowError(
      riskAnalysisConfigVersionNotFound(wrongRiskAnalysisVersion, tenantKind.PA)
    );
  });
});
