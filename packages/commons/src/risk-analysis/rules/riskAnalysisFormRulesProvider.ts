import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TenantKind } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { RiskAnalysisFormRules } from "./riskAnalysisFormRules.js";

/*  We avoid using import for JSON files because they would
require import assertions, an experimental feature that results
in experimental warnings that trigger our alarm systems */
const dirname = path.dirname(fileURLToPath(import.meta.url));
// ^^^ workaround to get __dirname equivalent in ES modules
const pa1 = path.resolve(dirname, "./PA/1.0.json");
const pa2 = path.resolve(dirname, "./PA/2.0.json");
const pa3 = path.resolve(dirname, "./PA/3.0.json");
const private1 = path.resolve(dirname, "./PRIVATE/1.0.json");
const private2 = path.resolve(dirname, "./PRIVATE/2.0.json");

function getFormRules(
  ruleset: "pa1" | "pa2" | "pa3" | "private1" | "private2"
): RiskAnalysisFormRules {
  return RiskAnalysisFormRules.parse(
    JSON.parse(
      fs.readFileSync(
        match(ruleset)
          .with("pa1", () => pa1)
          .with("pa2", () => pa2)
          .with("pa3", () => pa3)
          .with("private1", () => private1)
          .with("private2", () => private2)
          .exhaustive(),
        "utf-8"
      )
    )
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
