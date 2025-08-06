import { RiskAnalysis, riskAnalysisAnswerKind } from "pagopa-interop-models";
import { EServiceRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";
import { catalogReadModelServiceBuilder } from "../../src/catalog/catalogReadModelService.js";
import { readModelDB } from "../utils.js";

export const catalogReadModelService =
  catalogReadModelServiceBuilder(readModelDB);

export const generateEServiceRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
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
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);
