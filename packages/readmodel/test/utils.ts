import {
  RiskAnalysis,
  riskAnalysisAnswerKind,
  stringToDate,
} from "pagopa-interop-models";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { catalogReadModelServiceBuilder } from "../src/catalogReadModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

export const readModelService = catalogReadModelServiceBuilder(readModelDB);

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

export function stringToISOString(input: string): string;
export function stringToISOString(input: string | null): string | null;
export function stringToISOString(input: string | null): string | null {
  return input ? stringToDate(input).toISOString() : null;
}
