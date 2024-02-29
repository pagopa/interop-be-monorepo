import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import pa1 from "./PA/1.0.json";
import pa2 from "./PA/2.0.json";
import pa3 from "./PA/3.0.json";
import private1 from "./PRIVATE/1.0.json";
import private2 from "./PRIVATE/2.0.json";
import { RiskAnalysisFormTemplate } from "./models.js";

function getTemplate(
  template: "pa1" | "pa2" | "pa3" | "private1" | "private2"
): RiskAnalysisFormTemplate {
  return RiskAnalysisFormTemplate.parse(
    match(template)
      .with("pa1", () => pa1)
      .with("pa2", () => pa2)
      .with("pa3", () => pa3)
      .with("private1", () => private1)
      .with("private2", () => private2)
      .exhaustive()
  );
}

export const riskAnalysisTemplates: Record<
  TenantKind,
  RiskAnalysisFormTemplate[]
> = {
  PA: [getTemplate("pa1"), getTemplate("pa2"), getTemplate("pa3")],
  PRIVATE: [getTemplate("private1"), getTemplate("private2")],
  GSP: [getTemplate("private1"), getTemplate("private2")],
};
