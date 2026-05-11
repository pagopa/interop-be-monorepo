import {
  genericInternalError,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisContext,
  RiskAnalysisForm,
  RiskAnalysisId,
  RiskAnalysisMultiAnswer,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswer,
  RiskAnalysisSingleAnswerId,
  StandaloneRiskAnalysis,
  stringToDate,
  TenantKind,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  StandaloneRiskAnalysisAnswerSQL,
  StandaloneRiskAnalysisSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";

const aggregateRiskAnalysisForm = (
  riskAnalysisSQL: StandaloneRiskAnalysisSQL,
  answersSQL: StandaloneRiskAnalysisAnswerSQL[]
): RiskAnalysisForm => {
  const singleAnswers: RiskAnalysisSingleAnswer[] = answersSQL
    .filter((a) => a.kind === riskAnalysisAnswerKind.single)
    .map((a) => ({
      id: unsafeBrandId<RiskAnalysisSingleAnswerId>(a.id),
      key: a.key,
      value: a.value[0],
    }));

  const multiAnswers: RiskAnalysisMultiAnswer[] = answersSQL
    .filter((a) => a.kind === riskAnalysisAnswerKind.multi)
    .map((a) => ({
      id: unsafeBrandId<RiskAnalysisMultiAnswerId>(a.id),
      key: a.key,
      values: a.value,
    }));

  return {
    id: unsafeBrandId(riskAnalysisSQL.riskAnalysisFormId),
    version: riskAnalysisSQL.riskAnalysisFormVersion,
    singleAnswers,
    multiAnswers,
  };
};

export const aggregateStandaloneRiskAnalysis = (
  riskAnalysisSQL: StandaloneRiskAnalysisSQL,
  answersSQL: StandaloneRiskAnalysisAnswerSQL[]
): WithMetadata<StandaloneRiskAnalysis> => {
  const riskAnalysisForm = aggregateRiskAnalysisForm(
    riskAnalysisSQL,
    answersSQL
  );

  const riskAnalysis: StandaloneRiskAnalysis = {
    id: unsafeBrandId<RiskAnalysisId>(riskAnalysisSQL.id),
    name: riskAnalysisSQL.name,
    context: riskAnalysisSQL.context as RiskAnalysisContext,
    eserviceId:
      riskAnalysisSQL.eserviceId != null
        ? unsafeBrandId(riskAnalysisSQL.eserviceId)
        : undefined,
    templateId:
      riskAnalysisSQL.templateId != null
        ? unsafeBrandId(riskAnalysisSQL.templateId)
        : undefined,
    tenantKind:
      riskAnalysisSQL.tenantKind != null
        ? (riskAnalysisSQL.tenantKind as TenantKind)
        : undefined,
    createdAt: stringToDate(riskAnalysisSQL.createdAt),
    riskAnalysisForm,
  };

  return {
    data: riskAnalysis,
    metadata: { version: riskAnalysisSQL.metadataVersion },
  };
};

export const aggregateStandaloneRiskAnalysisArray = (
  riskAnalysesSQL: StandaloneRiskAnalysisSQL[],
  answersSQL: StandaloneRiskAnalysisAnswerSQL[]
): Array<WithMetadata<StandaloneRiskAnalysis>> => {
  const answersByRiskAnalysisId = new Map<
    string,
    StandaloneRiskAnalysisAnswerSQL[]
  >();

  for (const answer of answersSQL) {
    const existing = answersByRiskAnalysisId.get(answer.riskAnalysisId) ?? [];
    answersByRiskAnalysisId.set(answer.riskAnalysisId, [...existing, answer]);
  }

  return riskAnalysesSQL.map((ra) =>
    aggregateStandaloneRiskAnalysis(
      ra,
      answersByRiskAnalysisId.get(ra.id) ?? []
    )
  );
};
