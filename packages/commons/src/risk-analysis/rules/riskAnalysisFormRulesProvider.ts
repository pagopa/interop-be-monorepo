import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { pa1 } from "./PA/1.0.js";
import { pa2 } from "./PA/2.0.js";
import { pa3 } from "./PA/3.0.js";
import { private1 } from "./PRIVATE/1.0.js";
import { private2 } from "./PRIVATE/2.0.js";
import { RiskAnalysisFormRules } from "./riskAnalysisFormRules.js";

const formRules = {
  pa1,
  pa2,
  pa3,
  private1,
  private2,
};

function getFormRules(ruleset: keyof typeof formRules): RiskAnalysisFormRules {
  return RiskAnalysisFormRules.parse(
    match(ruleset)
      .with("pa1", () => pa1)
      .with("pa2", () => pa2)
      .with("pa3", () => pa3)
      .with("private1", () => private1)
      .with("private2", () => private2)
      .exhaustive()
  );
}

export const riskAnalysisFormRules: Record<
  TenantKind,
  RiskAnalysisFormRules[]
> = {
  PA: [getFormRules("pa1"), getFormRules("pa2"), getFormRules("pa3")],
  PRIVATE: [getFormRules("private1"), getFormRules("private2")],
  GSP: [getFormRules("private1"), getFormRules("private2")],
};
