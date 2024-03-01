import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import pa1 from "./PA/1.0.json";
import pa2 from "./PA/2.0.json";
import pa3 from "./PA/3.0.json";
import private1 from "./PRIVATE/1.0.json";
import private2 from "./PRIVATE/2.0.json";
import { RiskAnalysisFormRules } from "./models.js";

function getRules(
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
  PA: [getRules("pa1"), getRules("pa2"), getRules("pa3")],
  PRIVATE: [getRules("private1"), getRules("private2")],
  GSP: [getRules("private1"), getRules("private2")],
};
