import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import pa1 from "./PA/1.0.json" assert { type: "json" };
import pa2 from "./PA/2.0.json" assert { type: "json" };
import pa3 from "./PA/3.0.json" assert { type: "json" };
import private1 from "./PRIVATE/1.0.json" assert { type: "json" };
import private2 from "./PRIVATE/2.0.json" assert { type: "json" };
import { RiskAnalysisFormRules } from "./riskAnalysisFormRules.js";

function getFormRules(
  ruleset: "pa1" | "pa2" | "pa3" | "private1" | "private2"
): RiskAnalysisFormRules {
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
