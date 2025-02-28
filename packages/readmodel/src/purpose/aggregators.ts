import {
  DelegationId,
  genericInternalError,
  Purpose,
  PurposeId,
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
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";

// TODO: delete one aggregate array version
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

export const aggregatePurposeArrayWithMaps = ({
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
}): Array<WithMetadata<Purpose>> => {
  const riskAnalysisFormsSQLByPurposeId =
    createPurposeSQLPropertyMap(riskAnalysisFormsSQL);
  const riskAnalysisAnswersSQLByPurposeId = createPurposeSQLPropertyMap(
    riskAnalysisAnswersSQL
  );
  const versionsSQLByPurposeId = createPurposeSQLPropertyMap(versionsSQL);
  const versionDocumentsSQLByPurposeId =
    createPurposeSQLPropertyMap(versionDocumentsSQL);
  return purposesSQL.map((purposeSQL) => {
    const purposeId = unsafeBrandId<PurposeId>(purposeSQL.id);
    return aggregatePurpose({
      purposeSQL,
      riskAnalysisFormSQL: riskAnalysisFormsSQLByPurposeId.get(purposeId)?.[0],
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQLByPurposeId.get(purposeId),
      versionsSQL: versionsSQLByPurposeId.get(purposeId) || [],
      versionDocumentsSQL: versionDocumentsSQLByPurposeId.get(purposeId) || [],
    });
  });
};

const createPurposeSQLPropertyMap = <
  T extends
    | PurposeRiskAnalysisFormSQL
    | PurposeRiskAnalysisAnswerSQL
    | PurposeVersionSQL
    | PurposeVersionDocumentSQL
>(
  items: T[]
): Map<PurposeId, T[]> =>
  items.reduce((acc, item) => {
    const purposeId = unsafeBrandId<PurposeId>(item.purposeId);
    acc.set(purposeId, [...(acc.get(purposeId) || []), item]);
    return acc;
  }, new Map<PurposeId, T[]>());

export const aggregatePurpose = ({
  purposeSQL,
  riskAnalysisFormSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  versionDocumentsSQL,
}: {
  purposeSQL: PurposeSQL;
  riskAnalysisFormSQL: PurposeRiskAnalysisFormSQL | undefined;
  riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] | undefined;
  versionsSQL: PurposeVersionSQL[];
  versionDocumentsSQL: PurposeVersionDocumentSQL[];
}): WithMetadata<Purpose> => {
  const purposeRiskAnalysisForm = riskAnalysisFormSQLToPurposeRiskAnalysisForm(
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

  const purposeVersions = versionsSQL.reduce(
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
    ...(purposeSQL.updatedAt
      ? { updatedAt: stringToDate(purposeSQL.updatedAt) }
      : {}),
  };

  return {
    data: purpose,
    metadata: { version: purposeSQL.metadataVersion },
  };
};

// TODO: improve naming
export const riskAnalysisFormSQLToPurposeRiskAnalysisForm = (
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
