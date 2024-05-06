import { readFileSync } from "fs";
import { join } from "path";
import { TenantKind, tenantKind } from "pagopa-interop-models";
import { RiskAnalysisFormConfig } from "./riskAnalysisTemplate/riskAnalysisTemplate.js";

type RiskAnalysisFormConfigs = { [key: string]: RiskAnalysisFormConfig };
type RiskAnalysisFormsMap = {
  [key in TenantKind]: RiskAnalysisFormConfigs;
};

const loadRiskAnalysisFormConfig = (path: string): RiskAnalysisFormConfig => {
  const riskAnalysisTemplatePath: string = "riskAnalysisTemplate/forms";

  const configContent = readFileSync(
    join(riskAnalysisTemplatePath, path),
    "utf8"
  );
  return RiskAnalysisFormConfig.parse(configContent);
};

export const riskAnalysisFormsMap: RiskAnalysisFormsMap = {
  [tenantKind.PA]: {
    "1.0": loadRiskAnalysisFormConfig(join(tenantKind.PA, "1.0.json")),
    "2.0": loadRiskAnalysisFormConfig(join(tenantKind.PA, "2.0.json")),
    "3.0": loadRiskAnalysisFormConfig(join(tenantKind.PA, "3.0.json")),
  },
  [tenantKind.PRIVATE]: {
    "1.0": loadRiskAnalysisFormConfig(join(tenantKind.PRIVATE, "1.0.json")),
    "2.0": loadRiskAnalysisFormConfig(join(tenantKind.PRIVATE, "2.0.json")),
  },
  [tenantKind.GSP]: {
    "1.0": loadRiskAnalysisFormConfig(join(tenantKind.PRIVATE, "1.0.json")),
    "2.0": loadRiskAnalysisFormConfig(join(tenantKind.PRIVATE, "2.0.json")),
  },
};
