import {
  dateToString,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  riskAnalysisAnswerKind,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
} from "pagopa-interop-models";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "../types.js";

export const splitPurposeIntoObjectsSQL = (
  purpose: Purpose,
  version: number
): {
  purposeSQL: PurposeSQL;
  purposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined;
  purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] | undefined;
  purposeVersionsSQL: PurposeVersionSQL[];
  purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
} => {
  const purposeSQL: PurposeSQL = {
    id: purpose.id,
    metadataVersion: version,
    eserviceId: purpose.eserviceId,
    consumerId: purpose.consumerId,
    delegationId: purpose.delegationId || null,
    suspendedByConsumer:
      purpose.suspendedByConsumer === undefined
        ? null
        : purpose.suspendedByConsumer,
    suspendedByProducer:
      purpose.suspendedByProducer === undefined
        ? null
        : purpose.suspendedByProducer,
    title: purpose.title,
    description: purpose.description,
    createdAt: dateToString(purpose.createdAt),
    updatedAt: dateToString(purpose.updatedAt),
    isFreeOfCharge: purpose.isFreeOfCharge,
    freeOfChargeReason: purpose.freeOfChargeReason || null,
  };

  const splitPurposeRiskAnalysisSQL = splitRiskAnalysisFormIntoObjectsSQL(
    purpose.id,
    purpose.riskAnalysisForm,
    version
  );

  const { purposeVersionsSQL, purposeVersionDocumentsSQL } =
    purpose.versions.reduce(
      (
        acc: {
          purposeVersionsSQL: PurposeVersionSQL[];
          purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
        },
        currentPurposeVersion: PurposeVersion
      ) => {
        const { purposeVersionSQL, purposeVersionDocumentSQL } =
          splitPurposeVersionIntoObjectsSQL(
            purpose.id,
            currentPurposeVersion,
            version
          );
        return {
          purposeVersionsSQL: [...acc.purposeVersionsSQL, purposeVersionSQL],
          purposeVersionDocumentsSQL: [
            ...acc.purposeVersionDocumentsSQL,
            ...(purposeVersionDocumentSQL ? [purposeVersionDocumentSQL] : []),
          ],
        };
      },
      {
        purposeVersionsSQL: [],
        purposeVersionDocumentsSQL: [],
      }
    );

  return {
    purposeSQL,
    purposeRiskAnalysisFormSQL:
      splitPurposeRiskAnalysisSQL?.purposeRiskAnalysisFormSQL,
    purposeRiskAnalysisAnswersSQL:
      splitPurposeRiskAnalysisSQL?.purposeRiskAnalysisAnswersSQL,
    purposeVersionsSQL,
    purposeVersionDocumentsSQL,
  };
};

export const splitRiskAnalysisFormIntoObjectsSQL = (
  purposeId: PurposeId,
  riskAnalysisForm: PurposeRiskAnalysisForm | undefined,
  metadataVersion: number
):
  | {
      purposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL;
      purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
    }
  | undefined => {
  if (!riskAnalysisForm) {
    return undefined;
  }

  const purposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
    id: riskAnalysisForm.id,
    metadataVersion,
    purposeId,
    version: riskAnalysisForm.version,
  };

  const riskAnalysisSingleAnswers: PurposeRiskAnalysisAnswerSQL[] =
    riskAnalysisForm.singleAnswers.map(
      (a: RiskAnalysisSingleAnswer): PurposeRiskAnalysisAnswerSQL => ({
        id: a.id,
        purposeId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    );

  const riskAnalysisMultiAnswers: PurposeRiskAnalysisAnswerSQL[] =
    riskAnalysisForm.multiAnswers.map((a: RiskAnalysisMultiAnswer) => ({
      id: a.id,
      purposeId,
      metadataVersion,
      key: a.key,
      value: a.values,
      riskAnalysisFormId: riskAnalysisForm.id,
      kind: riskAnalysisAnswerKind.multi,
    }));

  return {
    purposeRiskAnalysisFormSQL,
    purposeRiskAnalysisAnswersSQL: [
      ...riskAnalysisSingleAnswers,
      ...riskAnalysisMultiAnswers,
    ],
  };
};

export const splitPurposeVersionIntoObjectsSQL = (
  purposeId: PurposeId,
  purposeVersion: PurposeVersion,
  metadataVersion: number
): {
  purposeVersionSQL: PurposeVersionSQL;
  purposeVersionDocumentSQL: PurposeVersionDocumentSQL | undefined;
} => {
  const purposeVersionSQL: PurposeVersionSQL = {
    id: purposeVersion.id,
    purposeId,
    metadataVersion,
    state: purposeVersion.state,
    dailyCalls: purposeVersion.dailyCalls,
    rejectionReason: purposeVersion.rejectionReason || null,
    createdAt: dateToString(purposeVersion.createdAt),
    updatedAt: dateToString(purposeVersion.updatedAt),
    firstActivationAt: dateToString(purposeVersion.firstActivationAt),
    suspendedAt: dateToString(purposeVersion.suspendedAt),
  };

  const purposeVersionDocumentSQL: PurposeVersionDocumentSQL | undefined =
    purposeVersion.riskAnalysis
      ? {
          purposeId,
          metadataVersion,
          purposeVersionId: purposeVersion.id,
          id: purposeVersion.riskAnalysis.id,
          contentType: purposeVersion.riskAnalysis.contentType,
          path: purposeVersion.riskAnalysis.path,
          createdAt: dateToString(purposeVersion.riskAnalysis.createdAt),
        }
      : undefined;

  return {
    purposeVersionSQL,
    purposeVersionDocumentSQL,
  };
};
