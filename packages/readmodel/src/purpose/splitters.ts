import {
  dateToString,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
  PurposeVersionSignedDocument,
  PurposeVersionStamp,
  PurposeVersionStampKind,
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
  PurposeVersionSignedDocumentSQL,
  PurposeVersionSQL,
  PurposeVersionStampSQL,
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
    purposeTemplateId,
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
    purposeTemplateId: purposeTemplateId || null,
  };

  const splitPurposeRiskAnalysisSQL = splitRiskAnalysisFormIntoObjectsSQL(
    id,
    riskAnalysisForm,
    version
  );

  const {
    versionsSQL,
    versionDocumentsSQL,
    versionStampsSQL,
    versionSignedDocumentsSQL,
  } = versions.reduce(
    (
      acc: {
        versionsSQL: PurposeVersionSQL[];
        versionDocumentsSQL: PurposeVersionDocumentSQL[];
        versionStampsSQL: PurposeVersionStampSQL[];
        versionSignedDocumentsSQL: PurposeVersionSignedDocumentSQL[];
      },
      currentPurposeVersion: PurposeVersion
    ) => {
      const {
        versionSQL,
        versionDocumentSQL,
        versionStampsSQL: stampsSQL,
        versionSignedDocumentSQL,
      } = splitPurposeVersionIntoObjectsSQL(id, currentPurposeVersion, version);
      return {
        versionsSQL: [...acc.versionsSQL, versionSQL],
        versionDocumentsSQL: [
          ...acc.versionDocumentsSQL,
          ...(versionDocumentSQL ? [versionDocumentSQL] : []),
        ],
        versionStampsSQL: [...acc.versionStampsSQL, ...stampsSQL],
        versionSignedDocumentsSQL: [
          ...acc.versionSignedDocumentsSQL,
          ...(versionSignedDocumentSQL ? [versionSignedDocumentSQL] : []),
        ],
      };
    },
    {
      versionsSQL: [],
      versionDocumentsSQL: [],
      versionStampsSQL: [],
      versionSignedDocumentsSQL: [],
    }
  );

  return {
    purposeSQL,
    riskAnalysisFormSQL: splitPurposeRiskAnalysisSQL?.riskAnalysisFormSQL,
    riskAnalysisAnswersSQL: splitPurposeRiskAnalysisSQL?.riskAnalysisAnswersSQL,
    versionsSQL,
    versionDocumentsSQL,
    versionStampsSQL,
    versionSignedDocumentsSQL,
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
    stamps,
    signedContract,
    ...rest
  }: PurposeVersion,
  metadataVersion: number
): {
  versionSQL: PurposeVersionSQL;
  versionDocumentSQL: PurposeVersionDocumentSQL | undefined;
  versionStampsSQL: PurposeVersionStampSQL[];
  versionSignedDocumentSQL: PurposeVersionSignedDocumentSQL | undefined;
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

  const versionSignedDocumentSQL =
    riskAnalysisToPurposeVersionSignedDocumentSQL(
      signedContract,
      purposeId,
      id,
      metadataVersion
    );

  const makeStampSQL = (
    { who, when, ...stampRest }: PurposeVersionStamp,
    purposeVersionId: PurposeVersionId,
    metadataVersion: number,
    kind: PurposeVersionStampKind
  ): PurposeVersionStampSQL => {
    void (stampRest satisfies Record<string, never>);

    return {
      purposeId,
      purposeVersionId,
      metadataVersion,
      kind,
      who,
      when: dateToString(when),
    };
  };

  const versionStampsSQL: PurposeVersionStampSQL[] = stamps
    ? Object.entries(stamps)
        .filter(
          (entry): entry is [PurposeVersionStampKind, PurposeVersionStamp] => {
            const [, stamp] = entry;
            return stamp !== undefined;
          }
        )
        .map(([key, stamp]) => makeStampSQL(stamp, id, metadataVersion, key))
    : [];

  return {
    versionSQL,
    versionDocumentSQL,
    versionStampsSQL,
    versionSignedDocumentSQL,
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
const riskAnalysisToPurposeVersionSignedDocumentSQL = (
  versionDocument: PurposeVersionSignedDocument | undefined,
  purposeId: PurposeId,
  purposeVersionId: PurposeVersionId,
  metadataVersion: number
): PurposeVersionSignedDocumentSQL | undefined => {
  if (!versionDocument) {
    return undefined;
  }

  const { id, createdAt, contentType, path, signedAt, ...rest } =
    versionDocument;
  void (rest satisfies Record<string, never>);

  return {
    id,
    metadataVersion,
    purposeId,
    purposeVersionId,
    createdAt: dateToString(createdAt),
    contentType,
    path,
    signedAt: dateToString(signedAt),
  };
};
