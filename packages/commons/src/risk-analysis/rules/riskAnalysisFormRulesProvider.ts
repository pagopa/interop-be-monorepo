import {
  genericInternalError,
  tenantKind,
  TenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import { pa1 } from "./PA/1.0.js";
import { pa2 } from "./PA/2.0.js";
import { pa3 } from "./PA/3.0.js";
import { private1 } from "./PRIVATE/1.0.js";
import { private2 } from "./PRIVATE/2.0.js";
import { RiskAnalysisFormRules } from "./riskAnalysisFormRules.js";
import { pa31 } from "./PA/3.1.js";

export const formRules = {
  PA_1_0: "PA-1.0",
  PA_2_0: "PA-2.0",
  PA_3_0: "PA-3.0",
  PA_3_1: "PA-3.1",
  PRIVATE_1_0: "PRIVATE-1.0",
  PRIVATE_2_0: "PRIVATE-2.0",
} as const;
export const FormRules = z.enum([
  Object.values(formRules)[0],
  ...Object.values(formRules).slice(1),
]);
export type FormRules = z.infer<typeof FormRules>;

export function buildLabel(kind: TenantKind, version: string): FormRules {
  const kindForRA = kind === tenantKind.PA ? tenantKind.PA : tenantKind.PRIVATE;
  const parsed = FormRules.safeParse(`${kindForRA}-${version}`);

  if (!parsed.success) {
    throw genericInternalError(
      `Unsupported ruleset for kind ${kind} and version ${version}`
    );
  }
  return parsed.data;
}

function getFormRules(ruleset: FormRules): RiskAnalysisFormRules {
  return RiskAnalysisFormRules.parse(
    match(ruleset)
      .with(formRules.PA_1_0, () => pa1)
      .with(formRules.PA_2_0, () => pa2)
      .with(formRules.PA_3_0, () => pa3)
      .with(formRules.PA_3_1, () => pa31)
      .with(formRules.PRIVATE_1_0, () => private1)
      .with(formRules.PRIVATE_2_0, () => private2)
      .exhaustive()
  );
}

export function getRulesetExpiration(
  kind: TenantKind | undefined,
  version: string
): Date | undefined {
  if (!kind) {
    return undefined;
  }

  const label = buildLabel(kind, version);

  const ruleset = RiskAnalysisFormRules.parse(
    match(label)
      .with(formRules.PA_1_0, () => pa1)
      .with(formRules.PA_2_0, () => pa2)
      .with(formRules.PA_3_0, () => pa3)
      .with(formRules.PA_3_1, () => pa31)
      .with(formRules.PRIVATE_1_0, () => private1)
      .with(formRules.PRIVATE_2_0, () => private2)
      .exhaustive()
  );
  return ruleset.expiration;
}

export const riskAnalysisFormRules: Record<
  TenantKind,
  RiskAnalysisFormRules[]
> = {
  PA: [
    getFormRules("PA-1.0"),
    getFormRules("PA-2.0"),
    getFormRules("PA-3.0"),
    getFormRules("PA-3.1"),
  ],
  PRIVATE: [getFormRules("PRIVATE-1.0"), getFormRules("PRIVATE-2.0")],
  GSP: [getFormRules("PRIVATE-1.0"), getFormRules("PRIVATE-2.0")],
  SCP: [getFormRules("PRIVATE-1.0"), getFormRules("PRIVATE-2.0")],
};
