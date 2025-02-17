import {
  genericInternalError,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
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
          ? // TODO: double check if .parse is enough or it should be filled manually
            PurposeVersionDocument.parse(purposeVersionDocumentSQL)
          : undefined;

      const purposeVersion: PurposeVersion = {
        ...PurposeVersion.parse(purposeVersionSQL),
        riskAnalysis: purposeVersionDocument,
      };

      return [...acc, purposeVersion];
    },
    []
  );

  const parsedPurpose = Purpose.safeParse(purposeSQL);

  const purpose: Purpose = {
    ...Purpose.parse(parsedPurpose.data),
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
            RiskAnalysisSingleAnswer.parse(answer),
          ],
          multiAnswers: acc.multiAnswers,
        }))
        .with({ kind: riskAnalysisAnswerKind.multi }, () => ({
          singleAnswers: acc.singleAnswers,
          multiAnswers: [
            ...acc.multiAnswers,
            RiskAnalysisMultiAnswer.parse(answer),
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
    ...PurposeRiskAnalysisForm.parse(purposeRiskAnalysisFormSQL),
    singleAnswers,
    multiAnswers,
  };
};
