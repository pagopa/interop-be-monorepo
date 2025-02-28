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
  PurposeItemsSQL,
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "pagopa-interop-readmodel-models";

export const splitPurposeIntoObjectsSQL = (
  purpose: Purpose,
  version: number
): PurposeItemsSQL => {
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

  const { versionsSQL, versionDocumentsSQL } = purpose.versions.reduce(
    (
      acc: {
        versionsSQL: PurposeVersionSQL[];
        versionDocumentsSQL: PurposeVersionDocumentSQL[];
      },
      currentPurposeVersion: PurposeVersion
    ) => {
      const { versionSQL, versionDocumentSQL } =
        splitPurposeVersionIntoObjectsSQL(
          purpose.id,
          currentPurposeVersion,
          version
        );
      return {
        versionsSQL: [...acc.versionsSQL, versionSQL],
        versionDocumentsSQL: [
          ...acc.versionDocumentsSQL,
          ...(versionDocumentSQL ? [versionDocumentSQL] : []),
        ],
      };
    },
    {
      versionsSQL: [],
      versionDocumentsSQL: [],
    }
  );

  return {
    purposeSQL,
    riskAnalysisFormSQL: splitPurposeRiskAnalysisSQL?.riskAnalysisFormSQL,
    riskAnalysisAnswersSQL: splitPurposeRiskAnalysisSQL?.riskAnalysisAnswersSQL,
    versionsSQL,
    versionDocumentsSQL,
  };
};

export const splitRiskAnalysisFormIntoObjectsSQL = (
  purposeId: PurposeId,
  riskAnalysisForm: PurposeRiskAnalysisForm | undefined,
  metadataVersion: number
):
  | {
      riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL;
      riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
    }
  | undefined => {
  if (!riskAnalysisForm) {
    return undefined;
  }
  const riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
    id: riskAnalysisForm.id,
    metadataVersion,
    purposeId,
    version: riskAnalysisForm.version,
    riskAnalysisId: riskAnalysisForm.riskAnalysisId || null,
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
    riskAnalysisFormSQL,
    riskAnalysisAnswersSQL: [
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
  versionSQL: PurposeVersionSQL;
  versionDocumentSQL: PurposeVersionDocumentSQL | undefined;
} => {
  const versionSQL: PurposeVersionSQL = {
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

  const versionDocumentSQL: PurposeVersionDocumentSQL | undefined =
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
    versionSQL,
    versionDocumentSQL,
  };
};
