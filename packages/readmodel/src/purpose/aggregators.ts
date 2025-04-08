import {
  DelegationId,
  genericInternalError,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
  PurposeVersionState,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisId,
  RiskAnalysisMultiAnswer,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswer,
  RiskAnalysisSingleAnswerId,
  stringToDate,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  PurposeSQL,
  PurposeRiskAnalysisAnswerSQL,
  PurposeVersionSQL,
  PurposeVersionDocumentSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeItemsSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";

export const aggregatePurposeArray = ({
  purposesSQL,
  riskAnalysisFormsSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  versionDocumentsSQL,
}: {
  purposesSQL: PurposeSQL[];
  riskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[];
  riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  versionsSQL: PurposeVersionSQL[];
  versionDocumentsSQL: PurposeVersionDocumentSQL[];
}): Array<WithMetadata<Purpose>> =>
  purposesSQL.map((purposeSQL) =>
    aggregatePurpose({
      purposeSQL,
      riskAnalysisFormSQL: riskAnalysisFormsSQL.find(
        (formSQL) => formSQL.purposeId === purposeSQL.id
      ),
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.filter(
        (answerSQL) => answerSQL.purposeId === purposeSQL.id
      ),
      versionsSQL: versionsSQL.filter(
        (versionSQL) => versionSQL.purposeId === purposeSQL.id
      ),
      versionDocumentsSQL: versionDocumentsSQL.filter(
        (docSQL) => docSQL.purposeId === purposeSQL.id
      ),
    })
  );

export const aggregatePurpose = ({
  purposeSQL,
  riskAnalysisFormSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  versionDocumentsSQL,
}: PurposeItemsSQL): WithMetadata<Purpose> => {
  const riskAnalysisForm = purposeRiskAnalysisFormSQLToPurposeRiskAnalysisForm(
    riskAnalysisFormSQL,
    riskAnalysisAnswersSQL
  );

  const documentsByPurposeVersionId: Map<
    PurposeVersionId,
    PurposeVersionDocumentSQL
  > = versionDocumentsSQL.reduce(
    (acc: Map<PurposeVersionId, PurposeVersionDocumentSQL>, docSQL) => {
      acc.set(unsafeBrandId<PurposeVersionId>(docSQL.purposeVersionId), docSQL);
      return acc;
    },
    new Map()
  );

  const versions = versionsSQL.reduce((acc: PurposeVersion[], versionSQL) => {
    const versionDocumentSQL = documentsByPurposeVersionId.get(
      unsafeBrandId(versionSQL.id)
    );
    const versionDocument: PurposeVersionDocument | undefined =
      versionDocumentSQL
        ? {
            id: unsafeBrandId(versionDocumentSQL.id),
            path: versionDocumentSQL.path,
            contentType: versionDocumentSQL.contentType,
            createdAt: stringToDate(versionDocumentSQL.createdAt),
          }
        : undefined;

    const version: PurposeVersion = {
      id: unsafeBrandId(versionSQL.id),
      state: PurposeVersionState.parse(versionSQL.state),
      dailyCalls: versionSQL.dailyCalls,
      createdAt: stringToDate(versionSQL.createdAt),
      ...(versionSQL.rejectionReason
        ? { rejectionReason: versionSQL.rejectionReason }
        : {}),
      ...(versionSQL.firstActivationAt
        ? { firstActivationAt: stringToDate(versionSQL.firstActivationAt) }
        : {}),
      ...(versionSQL.suspendedAt
        ? { suspendedAt: stringToDate(versionSQL.suspendedAt) }
        : {}),
      ...(versionSQL.updatedAt
        ? {
            updatedAt: stringToDate(versionSQL.updatedAt),
          }
        : {}),
      ...(versionDocument ? { riskAnalysis: versionDocument } : {}),
    };

    return [...acc, version];
  }, []);

  const purpose: Purpose = {
    id: unsafeBrandId(purposeSQL.id),
    title: purposeSQL.title,
    createdAt: stringToDate(purposeSQL.createdAt),
    eserviceId: unsafeBrandId(purposeSQL.eserviceId),
    consumerId: unsafeBrandId(purposeSQL.consumerId),
    description: purposeSQL.description,
    isFreeOfCharge: purposeSQL.isFreeOfCharge,
    versions,
    ...(riskAnalysisForm ? { riskAnalysisForm } : {}),
    ...(purposeSQL.suspendedByConsumer !== null
      ? {
          suspendedByConsumer: purposeSQL.suspendedByConsumer,
        }
      : {}),
    ...(purposeSQL.suspendedByProducer !== null
      ? {
          suspendedByProducer: purposeSQL.suspendedByProducer,
        }
      : {}),
    ...(purposeSQL.delegationId
      ? {
          delegationId: unsafeBrandId<DelegationId>(purposeSQL.delegationId),
        }
      : {}),
    ...(purposeSQL.freeOfChargeReason
      ? {
          freeOfChargeReason: purposeSQL.freeOfChargeReason,
        }
      : {}),
    ...(purposeSQL.updatedAt
      ? { updatedAt: stringToDate(purposeSQL.updatedAt) }
      : {}),
  };

  return {
    data: purpose,
    metadata: { version: purposeSQL.metadataVersion },
  };
};

const purposeRiskAnalysisFormSQLToPurposeRiskAnalysisForm = (
  riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined,
  answers: PurposeRiskAnalysisAnswerSQL[] | undefined
): PurposeRiskAnalysisForm | undefined => {
  if (!riskAnalysisFormSQL) {
    return undefined;
  }

  if (!answers) {
    throw genericInternalError(
      `Purpose risk analysis form with id ${riskAnalysisFormSQL.id} found without answers`
    );
  }

  const { singleAnswers, multiAnswers } = answers.reduce<{
    singleAnswers: RiskAnalysisSingleAnswer[];
    multiAnswers: RiskAnalysisMultiAnswer[];
  }>(
    (acc, answer) =>
      match({
        ...answer,
        kind: RiskAnalysisAnswerKind.parse(answer.kind),
      })
        .with({ kind: riskAnalysisAnswerKind.single }, (a) => ({
          singleAnswers: [
            ...acc.singleAnswers,
            {
              id: unsafeBrandId<RiskAnalysisSingleAnswerId>(a.id),
              key: a.key,
              ...(a.value
                ? {
                    value: a.value[0],
                  }
                : undefined),
            },
          ],
          multiAnswers: acc.multiAnswers,
        }))
        .with({ kind: riskAnalysisAnswerKind.multi }, (a) => ({
          singleAnswers: acc.singleAnswers,
          multiAnswers: [
            ...acc.multiAnswers,
            {
              id: unsafeBrandId<RiskAnalysisMultiAnswerId>(a.id),
              key: a.key,
              values: a.value || [],
            },
          ],
        }))
        .exhaustive(),
    {
      singleAnswers: [],
      multiAnswers: [],
    }
  );

  return {
    id: unsafeBrandId(riskAnalysisFormSQL.id),
    version: riskAnalysisFormSQL.version,
    singleAnswers,
    multiAnswers,
    ...(riskAnalysisFormSQL.riskAnalysisId
      ? {
          riskAnalysisId: unsafeBrandId<RiskAnalysisId>(
            riskAnalysisFormSQL.riskAnalysisId
          ),
        }
      : {}),
  };
};
