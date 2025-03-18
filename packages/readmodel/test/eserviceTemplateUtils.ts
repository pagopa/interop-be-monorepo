import { RiskAnalysis, riskAnalysisAnswerKind } from "pagopa-interop-models";
import { EServiceTemplateRiskAnalysisAnswerSQL } from "pagopa-interop-readmodel-models";

export const generateEServiceTemplateRiskAnalysisAnswersSQL = (
  eserviceTemplateId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceTemplateRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);
