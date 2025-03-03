import { RiskAnalysis, riskAnalysisAnswerKind } from "pagopa-interop-models";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { readModelServiceBuilder } from "../src/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

export const readModelService = readModelServiceBuilder(readModelDB);

afterEach(cleanup);
export const generateRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[]
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion: 1,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion: 1,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

export function dateToCustomISOString(input: Date): string;
export function dateToCustomISOString(input: Date | undefined): string | null;
export function dateToCustomISOString(input: Date | undefined): string | null {
  return input
    ? input.toISOString().replace("T", " ").replace("Z", "+00")
    : null;
}
