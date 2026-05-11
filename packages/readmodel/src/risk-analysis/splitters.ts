import {
  dateToString,
  riskAnalysisAnswerKind,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
  StandaloneRiskAnalysis,
} from "pagopa-interop-models";
import {
  StandaloneRiskAnalysisAnswerSQL,
  StandaloneRiskAnalysisItemsSQL,
  StandaloneRiskAnalysisSQL,
} from "pagopa-interop-readmodel-models";

export const splitStandaloneRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: StandaloneRiskAnalysis,
  metadataVersion: number
): StandaloneRiskAnalysisItemsSQL => {
  const riskAnalysisSQL: StandaloneRiskAnalysisSQL = {
    id: riskAnalysis.id,
    metadataVersion,
    name: riskAnalysis.name,
    context: riskAnalysis.context,
    eserviceId: riskAnalysis.eserviceId ?? null,
    templateId: riskAnalysis.templateId ?? null,
    tenantKind: riskAnalysis.tenantKind ?? null,
    createdAt: dateToString(riskAnalysis.createdAt),
    riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
    riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
  };

  const singleAnswers: StandaloneRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.singleAnswers.map(
      (answer: RiskAnalysisSingleAnswer) => ({
        id: answer.id,
        riskAnalysisId: riskAnalysis.id,
        metadataVersion,
        riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
        key: answer.key,
        value: answer.value != null ? [answer.value] : [],
      })
    );

  const multiAnswers: StandaloneRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.multiAnswers.map(
      (answer: RiskAnalysisMultiAnswer) => ({
        id: answer.id,
        riskAnalysisId: riskAnalysis.id,
        metadataVersion,
        riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
        key: answer.key,
        value: answer.values,
      })
    );

  return {
    riskAnalysisSQL,
    riskAnalysisAnswersSQL: [...singleAnswers, ...multiAnswers],
  };
};
