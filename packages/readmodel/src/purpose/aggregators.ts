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
  PurposeRiskAnalysisFormSQL,
  PurposeRiskAnalysisAnswerSQL,
  PurposeVersionSQL,
  PurposeVersionDocumentSQL,
  PurposeItemsSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";

// TODO: delete one aggregate array version
export const aggregatePurposeArray = ({
  purposesSQL,
  purposeRiskAnalysisFormsSQL,
  purposeRiskAnalysisAnswersSQL,
  purposeVersionsSQL,
  purposeVersionDocumentsSQL,
}: {
  purposesSQL: PurposeSQL[];
  purposeRiskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[];
  purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  purposeVersionsSQL: PurposeVersionSQL[];
  purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
}): Array<WithMetadata<Purpose>> =>
  purposesSQL.map((purposeSQL) =>
    aggregatePurpose({
      purposeSQL,
      purposeRiskAnalysisFormSQL: purposeRiskAnalysisFormsSQL.find(
        (formSQL) => formSQL.purposeId === purposeSQL.id
      ),
      purposeRiskAnalysisAnswersSQL: purposeRiskAnalysisAnswersSQL.filter(
        (answerSQL) => answerSQL.purposeId === purposeSQL.id
      ),
      purposeVersionsSQL: purposeVersionsSQL.filter(
        (versionSQL) => versionSQL.purposeId === purposeSQL.id
      ),
      purposeVersionDocumentsSQL: purposeVersionDocumentsSQL.filter(
        (docSQL) => docSQL.purposeId === purposeSQL.id
      ),
    })
  );

export const aggregatePurposeArrayWithMaps = ({
  purposesSQL,
  purposeRiskAnalysisFormsSQL,
  purposeRiskAnalysisAnswersSQL,
  purposeVersionsSQL,
  purposeVersionDocumentsSQL,
}: {
  purposesSQL: PurposeSQL[];
  purposeRiskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[];
  purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  purposeVersionsSQL: PurposeVersionSQL[];
  purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[];
}): Array<WithMetadata<Purpose>> => {
  const riskAnalysisFormsSQLByPurposeId = createPurposeSQLPropertyMap(
    purposeRiskAnalysisFormsSQL
  );
  const riskAnalysisAnswersSQLByPurposeId = createPurposeSQLPropertyMap(
    purposeRiskAnalysisAnswersSQL
  );
  const versionsSQLByPurposeId =
    createPurposeSQLPropertyMap(purposeVersionsSQL);
  const versionDocumentsSQLByPurposeId = createPurposeSQLPropertyMap(
    purposeVersionDocumentsSQL
  );
  return purposesSQL.map((purposeSQL) => {
    const purposeId = unsafeBrandId<PurposeId>(purposeSQL.id);
    return aggregatePurpose({
      purposeSQL,
      purposeRiskAnalysisFormSQL:
        riskAnalysisFormsSQLByPurposeId.get(purposeId)?.[0],
      purposeRiskAnalysisAnswersSQL:
        riskAnalysisAnswersSQLByPurposeId.get(purposeId),
      purposeVersionsSQL: versionsSQLByPurposeId.get(purposeId) || [],
      purposeVersionDocumentsSQL:
        versionDocumentsSQLByPurposeId.get(purposeId) || [],
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

// TODO: ...rest
export const aggregatePurpose = ({
  purposeSQL,
  purposeRiskAnalysisFormSQL,
  purposeRiskAnalysisAnswersSQL,
  purposeVersionsSQL,
  purposeVersionDocumentsSQL,
}: PurposeItemsSQL): WithMetadata<Purpose> => {
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
    singleAnswers,
    multiAnswers,
    ...(purposeRiskAnalysisFormSQL.riskAnalysisId
      ? {
          riskAnalysisId: unsafeBrandId<RiskAnalysisId>(
            purposeRiskAnalysisFormSQL.riskAnalysisId
          ),
        }
      : {}),
  };
};

export const fromJoinToAggregatorPurpose = (
  queryRes: Array<{
    purpose: PurposeSQL;
    purposeRiskAnalysisForm: PurposeRiskAnalysisFormSQL | null;
    purposeRiskAnalysisAnswer: PurposeRiskAnalysisAnswerSQL | null;
    purposeVersion: PurposeVersionSQL | null;
    purposeVersionDocument: PurposeVersionDocumentSQL | null;
  }>
): PurposeItemsSQL => {
  const purposeSQL = queryRes[0].purpose;
  const purposeRiskAnalysisFormSQL = queryRes[0].purposeRiskAnalysisForm;

  const purposeRiskAnalysisAnswerIdSet = new Set<string>();
  const purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] = [];

  const purposeVersionIdSet = new Set<string>();
  const purposeVersionsSQL: PurposeVersionSQL[] = [];

  const purposeVersionDocumentIdSet = new Set<string>();
  const purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[] = [];

  queryRes.forEach((row) => {
    const purposeRiskAnalysisFormSQL = row.purposeRiskAnalysisForm;

    if (purposeRiskAnalysisFormSQL) {
      const purposeRiskAnalysisAnswerSQL = row.purposeRiskAnalysisAnswer;

      if (
        purposeRiskAnalysisAnswerSQL &&
        !purposeRiskAnalysisAnswerIdSet.has(purposeRiskAnalysisAnswerSQL.id)
      ) {
        purposeRiskAnalysisAnswerIdSet.add(purposeRiskAnalysisAnswerSQL.id);
        // eslint-disable-next-line functional/immutable-data
        purposeRiskAnalysisAnswersSQL.push(purposeRiskAnalysisAnswerSQL);
      }
    }

    const purposeVersionSQL = row.purposeVersion;
    if (purposeVersionSQL) {
      if (!purposeVersionIdSet.has(purposeVersionSQL.id)) {
        purposeVersionIdSet.add(purposeVersionSQL.id);
        // eslint-disable-next-line functional/immutable-data
        purposeVersionsSQL.push(purposeVersionSQL);
      }

      const purposeVersionDocumentSQL = row.purposeVersionDocument;
      if (
        purposeVersionDocumentSQL &&
        !purposeVersionDocumentIdSet.has(purposeVersionDocumentSQL.id)
      ) {
        purposeVersionDocumentIdSet.add(purposeVersionDocumentSQL.id);
        // eslint-disable-next-line functional/immutable-data
        purposeVersionDocumentsSQL.push(purposeVersionDocumentSQL);
      }
    }
  });

  return {
    purposeSQL,
    purposeRiskAnalysisFormSQL: purposeRiskAnalysisFormSQL || undefined,
    purposeRiskAnalysisAnswersSQL:
      purposeRiskAnalysisAnswersSQL.length > 0
        ? purposeRiskAnalysisAnswersSQL
        : undefined,
    purposeVersionsSQL,
    purposeVersionDocumentsSQL,
  };
};
