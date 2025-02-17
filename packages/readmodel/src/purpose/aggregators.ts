import {
  genericInternalError,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
  PurposeVersionState,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
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
        riskAnalysis: purposeVersionDocument,
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
    riskAnalysisForm: purposeRiskAnalysisForm,
  };

  return {
    data: purpose,
    metadata: { version: purposeSQL.metadataVersion },
  };
};

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

  const { singleAnswers, multiAnswers } = answers.reduce(
    (
      acc: {
        singleAnswers: RiskAnalysisSingleAnswer[];
        multiAnswers: RiskAnalysisMultiAnswer[];
      },
      answer
    ) => {
      match({
        ...answer,
        kind: RiskAnalysisAnswerKind.parse(answer.kind),
      })
        .with({ kind: riskAnalysisAnswerKind.single }, () => ({
          singleAnswers: [
            ...acc.singleAnswers,
            {
              id: unsafeBrandId(answer.id),
              key: answer.key,
              value: answer.value?.[0],
            },
          ],
          multiAnswers: acc.multiAnswers,
        }))
        .with({ kind: riskAnalysisAnswerKind.multi }, () => ({
          singleAnswers: acc.singleAnswers,
          multiAnswers: [
            ...acc.multiAnswers,
            {
              id: answer.id,
              key: answer.key,
              values: answer.value,
            },
          ],
        }))
        .exhaustive();

      return acc;
    },
    {
      singleAnswers: [],
      multiAnswers: [],
    }
  );

  return {
    id: unsafeBrandId(purposeRiskAnalysisFormSQL.id),
    version: purposeRiskAnalysisFormSQL.version,
    riskAnalysisId: unsafeBrandId(purposeRiskAnalysisFormSQL.riskAnalysisId),
    singleAnswers,
    multiAnswers,
  };
};
