import {
  dateToString,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
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
  {
    id,
    eserviceId,
    consumerId,
    delegationId,
    suspendedByConsumer,
    suspendedByProducer,
    title,
    description,
    createdAt,
    updatedAt,
    isFreeOfCharge,
    freeOfChargeReason,
    riskAnalysisForm,
    versions,
    ...rest
  }: Purpose,
  version: number
): PurposeItemsSQL => {
  void (rest satisfies Record<string, never>);

  const purposeSQL: PurposeSQL = {
    id,
    metadataVersion: version,
    eserviceId,
    consumerId,
    delegationId: delegationId || null,
    suspendedByConsumer:
      suspendedByConsumer === undefined ? null : suspendedByConsumer,
    suspendedByProducer:
      suspendedByProducer === undefined ? null : suspendedByProducer,
    title,
    description,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    isFreeOfCharge,
    freeOfChargeReason: freeOfChargeReason || null,
  };

  const splitPurposeRiskAnalysisSQL = splitRiskAnalysisFormIntoObjectsSQL(
    id,
    riskAnalysisForm,
    version
  );

  const { versionsSQL, versionDocumentsSQL } = versions.reduce(
    (
      acc: {
        versionsSQL: PurposeVersionSQL[];
        versionDocumentsSQL: PurposeVersionDocumentSQL[];
      },
      currentPurposeVersion: PurposeVersion
    ) => {
      const { versionSQL, versionDocumentSQL } =
        splitPurposeVersionIntoObjectsSQL(id, currentPurposeVersion, version);
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

const splitRiskAnalysisFormIntoObjectsSQL = (
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

  const {
    id: riskAnalysisFormId,
    version,
    singleAnswers,
    multiAnswers,
    riskAnalysisId,
    ...rest
  } = riskAnalysisForm;
  void (rest satisfies Record<string, never>);

  const riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL = {
    id: riskAnalysisFormId,
    metadataVersion,
    purposeId,
    version,
    riskAnalysisId: riskAnalysisId || null,
  };

  const riskAnalysisSingleAnswers: PurposeRiskAnalysisAnswerSQL[] =
    singleAnswers.map(
      ({
        id: answerId,
        key,
        value,
        ...answerRest
      }: RiskAnalysisSingleAnswer) => {
        void (answerRest satisfies Record<string, never>);
        return {
          id: answerId,
          purposeId,
          metadataVersion,
          key,
          value: value ? [value] : [],
          riskAnalysisFormId,
          kind: riskAnalysisAnswerKind.single,
        };
      }
    );

  const riskAnalysisMultiAnswers: PurposeRiskAnalysisAnswerSQL[] =
    multiAnswers.map(
      ({
        id: answerId,
        key,
        values,
        ...answerRest
      }: RiskAnalysisMultiAnswer) => {
        void (answerRest satisfies Record<string, never>);
        return {
          id: answerId,
          purposeId,
          metadataVersion,
          key,
          value: values,
          riskAnalysisFormId,
          kind: riskAnalysisAnswerKind.multi,
        };
      }
    );

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
  {
    id,
    state,
    dailyCalls,
    rejectionReason,
    createdAt,
    updatedAt,
    firstActivationAt,
    suspendedAt,
    riskAnalysis,
    ...rest
  }: PurposeVersion,
  metadataVersion: number
): {
  versionSQL: PurposeVersionSQL;
  versionDocumentSQL: PurposeVersionDocumentSQL | undefined;
} => {
  void (rest satisfies Record<string, never>);

  const versionSQL: PurposeVersionSQL = {
    id,
    purposeId,
    metadataVersion,
    state,
    dailyCalls,
    rejectionReason: rejectionReason || null,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    firstActivationAt: dateToString(firstActivationAt),
    suspendedAt: dateToString(suspendedAt),
  };

  const versionDocumentSQL = riskAnalysisToPurposeVersionDocumentSQL(
    riskAnalysis,
    purposeId,
    id,
    metadataVersion
  );

  return {
    versionSQL,
    versionDocumentSQL,
  };
};

const riskAnalysisToPurposeVersionDocumentSQL = (
  versionDocument: PurposeVersionDocument | undefined,
  purposeId: PurposeId,
  purposeVersionId: PurposeVersionId,
  metadataVersion: number
): PurposeVersionDocumentSQL | undefined => {
  if (!versionDocument) {
    return undefined;
  }

  const { id, createdAt, contentType, path, ...rest } = versionDocument;
  void (rest satisfies Record<string, never>);

  return {
    id,
    metadataVersion,
    purposeId,
    purposeVersionId,
    createdAt: dateToString(createdAt),
    contentType,
    path,
  };
};
