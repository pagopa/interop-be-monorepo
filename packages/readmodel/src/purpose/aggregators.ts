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
import { match } from "ts-pattern";
import {
  PurposeRiskAnalysisAnswerSQL,
  PurposeRiskAnalysisFormSQL,
  PurposeSQL,
  PurposeVersionDocumentSQL,
  PurposeVersionSQL,
} from "../types.js";

// TODO: ...rest
export const purposeSQLToPurpose = ({
  purposeSQL,
  purposeRiskAnalysisFormSQL,
  purposeRiskAnalysisAnswersSQL,
  purposeVersionsSQL,
  purposeVersionDocumentsSQL,
}: {
  purposeSQL: PurposeSQL;
  purposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined;
  purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] | undefined;
  purposeVersionsSQL: PurposeVersionSQL[];
  purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
}): WithMetadata<Purpose> => {
  const purposeRiskAnalysisForm =
    purposeRiskAnalysisFormSQLToPurposeRiskAnalysisForm(
      purposeRiskAnalysisFormSQL,
      purposeRiskAnalysisAnswersSQL
    );

  const documentsByPurposeVersionId: Map<
    PurposeVersionId,
    PurposeVersionDocumentSQL
  > = purposeVersionDocumentsSQL.reduce(
    (acc: Map<PurposeVersionId, PurposeVersionDocumentSQL>, docSQL) => {
      acc.set(unsafeBrandId<PurposeVersionId>(docSQL.purposeVersionId), docSQL);
      return acc;
    },
    new Map()
  );

  const purposeVersions = purposeVersionsSQL.reduce(
    (acc: PurposeVersion[], purposeVersionSQL) => {
      const purposeVersionDocumentSQL = documentsByPurposeVersionId.get(
        unsafeBrandId(purposeVersionSQL.id)
      );
      const purposeVersionDocument: PurposeVersionDocument | undefined =
        purposeVersionDocumentSQL
          ? {
              id: unsafeBrandId(purposeVersionDocumentSQL.id),
              path: purposeVersionDocumentSQL.path,
              contentType: purposeVersionDocumentSQL.contentType,
              createdAt: stringToDate(purposeVersionDocumentSQL.createdAt),
            }
          : undefined;

      const purposeVersion: PurposeVersion = {
        id: unsafeBrandId(purposeVersionSQL.id),
        state: PurposeVersionState.parse(purposeVersionSQL.state),
        dailyCalls: purposeVersionSQL.dailyCalls,
        createdAt: stringToDate(purposeVersionSQL.createdAt),
        ...(purposeVersionSQL.rejectionReason
          ? { rejectionReason: purposeVersionSQL.rejectionReason }
          : {}),
        firstActivationAt: stringToDate(purposeVersionSQL.firstActivationAt),
        ...(purposeVersionSQL.suspendedAt
          ? { suspendedAt: stringToDate(purposeVersionSQL.suspendedAt) }
          : {}),
        ...(purposeVersionSQL.updatedAt
          ? {
              updatedAt: stringToDate(purposeVersionSQL.updatedAt),
            }
          : {}),
        ...(purposeVersionDocument
          ? { riskAnalysis: purposeVersionDocument }
          : {}),
      };

      return [...acc, purposeVersion];
    },
    []
  );

  const purpose: Purpose = {
    id: unsafeBrandId(purposeSQL.id),
    title: purposeSQL.title,
    createdAt: stringToDate(purposeSQL.createdAt),
    eserviceId: unsafeBrandId(purposeSQL.eserviceId),
    consumerId: unsafeBrandId(purposeSQL.consumerId),
    description: purposeSQL.description,
    isFreeOfCharge: purposeSQL.isFreeOfCharge,
    versions: purposeVersions,
    ...(purposeRiskAnalysisForm
      ? { riskAnalysisForm: purposeRiskAnalysisForm }
      : {}),
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
  };

  return {
    data: purpose,
    metadata: { version: purposeSQL.metadataVersion },
  };
};

// TODO: improve naming
export const purposeRiskAnalysisFormSQLToPurposeRiskAnalysisForm = (
  purposeRiskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined,
  answers: PurposeRiskAnalysisAnswerSQL[] | undefined
): PurposeRiskAnalysisForm | undefined => {
  if (!purposeRiskAnalysisFormSQL) {
    return undefined;
  }

  if (!answers) {
    throw genericInternalError(
      `Purpose risk analysis form with id ${purposeRiskAnalysisFormSQL.id} found without answers`
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
    id: unsafeBrandId(purposeRiskAnalysisFormSQL.id),
    version: purposeRiskAnalysisFormSQL.version,
    riskAnalysisId: purposeRiskAnalysisFormSQL.riskAnalysisId
      ? unsafeBrandId<RiskAnalysisId>(purposeRiskAnalysisFormSQL.riskAnalysisId)
      : undefined,
    singleAnswers,
    multiAnswers,
  };
};
