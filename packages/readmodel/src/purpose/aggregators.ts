import {
  DelegationId,
  genericInternalError,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisForm,
  PurposeTemplateId,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionId,
  PurposeVersionStamp,
  PurposeVersionStampKind,
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
  PurposeVersionStampSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregatePurposeArray = ({
  purposesSQL,
  riskAnalysisFormsSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  versionDocumentsSQL,
  versionStampsSQL,
}: {
  purposesSQL: PurposeSQL[];
  riskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[];
  riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  versionsSQL: PurposeVersionSQL[];
  versionDocumentsSQL: PurposeVersionDocumentSQL[];
  versionStampsSQL: PurposeVersionStampSQL[];
}): Array<WithMetadata<Purpose>> => {
  const riskAnalysisFormsSQLByPurposeId =
    createPurposeSQLPropertyMap(riskAnalysisFormsSQL);
  const riskAnalysisAnswersSQLByPurposeId = createPurposeSQLPropertyMap(
    riskAnalysisAnswersSQL
  );
  const versionsSQLByPurposeId = createPurposeSQLPropertyMap(versionsSQL);
  const versionDocumentsSQLByPurposeId =
    createPurposeSQLPropertyMap(versionDocumentsSQL);
  const versionStampsSQLByPurposeId =
    createPurposeSQLPropertyMap(versionStampsSQL);

  return purposesSQL.map((purposeSQL) => {
    const purposeId = unsafeBrandId<PurposeId>(purposeSQL.id);

    return aggregatePurpose({
      purposeSQL,
      riskAnalysisFormSQL: riskAnalysisFormsSQLByPurposeId.get(purposeId)?.[0],
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQLByPurposeId.get(purposeId),
      versionsSQL: versionsSQLByPurposeId.get(purposeId) || [],
      versionDocumentsSQL: versionDocumentsSQLByPurposeId.get(purposeId) || [],
      versionStampsSQL: versionStampsSQLByPurposeId.get(purposeId) || [],
    });
  });
};

const createPurposeSQLPropertyMap = <
  T extends
    | PurposeRiskAnalysisFormSQL
    | PurposeRiskAnalysisAnswerSQL
    | PurposeVersionSQL
    | PurposeVersionDocumentSQL
    | PurposeVersionStampSQL
>(
  items: T[]
): Map<PurposeId, T[]> =>
  items.reduce((acc, item) => {
    const purposeId = unsafeBrandId<PurposeId>(item.purposeId);
    const values = acc.get(purposeId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(purposeId, values);

    return acc;
  }, new Map<PurposeId, T[]>());

export const aggregatePurpose = ({
  purposeSQL,
  riskAnalysisFormSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  versionDocumentsSQL,
  versionStampsSQL,
}: // eslint-disable-next-line sonarjs/cognitive-complexity
PurposeItemsSQL): WithMetadata<Purpose> => {
  const riskAnalysisForm = purposeRiskAnalysisFormSQLToPurposeRiskAnalysisForm(
    riskAnalysisFormSQL,
    riskAnalysisAnswersSQL
  );

  const documentsByPurposeVersionId: Map<
    PurposeVersionId,
    PurposeVersionDocumentSQL
  > = versionDocumentsSQL.reduce(
    (acc: Map<PurposeVersionId, PurposeVersionDocumentSQL>, docSQL) => {
      acc.set(unsafeBrandId(docSQL.purposeVersionId), docSQL);
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

    const { creation: creationStampSQL } = versionStampsSQL
      .filter((s) => s.purposeVersionId === versionSQL.id)
      .reduce(
        (
          acc: { [key in PurposeVersionStampKind]?: PurposeVersionStampSQL },
          stamp
        ) =>
          match(PurposeVersionStampKind.parse(stamp.kind))
            .with(PurposeVersionStampKind.enum.creation, () => ({
              ...acc,
              creation: stamp,
            }))
            .exhaustive(),
        {}
      );

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
      ...(creationStampSQL
        ? {
            stamps: {
              creation:
                purposeVersionStampSQLtoPurposeVersionStamp(creationStampSQL),
            },
          }
        : {}),
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
    ...(purposeSQL.purposeTemplateId
      ? {
          purposeTemplateId: unsafeBrandId<PurposeTemplateId>(
            purposeSQL.purposeTemplateId
          ),
        }
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
              value: a.value.length > 0 ? a.value[0] : undefined,
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

const purposeVersionStampSQLtoPurposeVersionStamp = (
  stampSQL: PurposeVersionStampSQL
): PurposeVersionStamp => ({
  who: unsafeBrandId(stampSQL.who),
  when: stringToDate(stampSQL.when),
});

export const toPurposeAggregator = (
  queryRes: Array<{
    purpose: PurposeSQL;
    purposeRiskAnalysisForm: PurposeRiskAnalysisFormSQL | null;
    purposeRiskAnalysisAnswer: PurposeRiskAnalysisAnswerSQL | null;
    purposeVersion: PurposeVersionSQL | null;
    purposeVersionDocument: PurposeVersionDocumentSQL | null;
    purposeVersionStamp: PurposeVersionStampSQL | null;
  }>
): PurposeItemsSQL => {
  const {
    purposesSQL,
    riskAnalysisFormsSQL,
    riskAnalysisAnswersSQL,
    versionsSQL,
    versionDocumentsSQL,
    versionStampsSQL,
  } = toPurposeAggregatorArray(queryRes);

  throwIfMultiple(purposesSQL, "purpose");

  return {
    purposeSQL: purposesSQL[0],
    riskAnalysisFormSQL: riskAnalysisFormsSQL[0],
    riskAnalysisAnswersSQL,
    versionsSQL,
    versionDocumentsSQL,
    versionStampsSQL,
  };
};

export const toPurposeAggregatorArray = (
  queryRes: Array<{
    purpose: PurposeSQL;
    purposeRiskAnalysisForm: PurposeRiskAnalysisFormSQL | null;
    purposeRiskAnalysisAnswer: PurposeRiskAnalysisAnswerSQL | null;
    purposeVersion: PurposeVersionSQL | null;
    purposeVersionDocument: PurposeVersionDocumentSQL | null;
    purposeVersionStamp: PurposeVersionStampSQL | null;
  }>
): {
  purposesSQL: PurposeSQL[];
  riskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[];
  riskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[];
  versionsSQL: PurposeVersionSQL[];
  versionDocumentsSQL: PurposeVersionDocumentSQL[];
  versionStampsSQL: PurposeVersionStampSQL[];
} => {
  const purposeIdSet = new Set<string>();
  const purposesSQL: PurposeSQL[] = [];

  const purposeRiskAnalysisFormIdSet = new Set<string>();
  const purposeRiskAnalysisFormsSQL: PurposeRiskAnalysisFormSQL[] = [];

  const purposeRiskAnalysisAnswerIdSet = new Set<string>();
  const purposeRiskAnalysisAnswersSQL: PurposeRiskAnalysisAnswerSQL[] = [];

  const purposeVersionIdSet = new Set<string>();
  const purposeVersionsSQL: PurposeVersionSQL[] = [];

  const purposeVersionDocumentIdSet = new Set<string>();
  const purposeVersionDocumentsSQL: PurposeVersionDocumentSQL[] = [];

  const purposeVersionStampIdSet = new Set<string>();
  const purposeVersionStampsSQL: PurposeVersionStampSQL[] = [];
  // eslint-disable-next-line sonarjs/cognitive-complexity
  queryRes.forEach((row) => {
    const purposeSQL = row.purpose;
    if (!purposeIdSet.has(purposeSQL.id)) {
      purposeIdSet.add(purposeSQL.id);
      // eslint-disable-next-line functional/immutable-data
      purposesSQL.push(purposeSQL);
    }

    const purposeRiskAnalysisFormSQL = row.purposeRiskAnalysisForm;
    const purposeRiskAnalysisFormPK = purposeRiskAnalysisFormSQL
      ? makeUniqueKey([
          purposeRiskAnalysisFormSQL.id,
          purposeRiskAnalysisFormSQL.purposeId,
        ])
      : undefined;
    if (purposeRiskAnalysisFormSQL && purposeRiskAnalysisFormPK) {
      if (!purposeRiskAnalysisFormIdSet.has(purposeRiskAnalysisFormPK)) {
        purposeRiskAnalysisFormIdSet.add(purposeRiskAnalysisFormPK);
        // eslint-disable-next-line functional/immutable-data
        purposeRiskAnalysisFormsSQL.push(purposeRiskAnalysisFormSQL);
      }

      const purposeRiskAnalysisAnswerSQL = row.purposeRiskAnalysisAnswer;
      const purposeRiskAnalysisAnswerPK = purposeRiskAnalysisAnswerSQL
        ? makeUniqueKey([
            purposeRiskAnalysisAnswerSQL.id,
            purposeRiskAnalysisAnswerSQL.purposeId,
          ])
        : undefined;
      if (
        purposeRiskAnalysisAnswerSQL &&
        purposeRiskAnalysisAnswerPK &&
        !purposeRiskAnalysisAnswerIdSet.has(purposeRiskAnalysisAnswerPK)
      ) {
        purposeRiskAnalysisAnswerIdSet.add(purposeRiskAnalysisAnswerPK);
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
      const purposeVersionDocumentPK = purposeVersionDocumentSQL
        ? makeUniqueKey([
            purposeVersionDocumentSQL.id,
            purposeVersionDocumentSQL.purposeVersionId,
          ])
        : undefined;
      if (
        purposeVersionDocumentSQL &&
        purposeVersionDocumentPK &&
        !purposeVersionDocumentIdSet.has(purposeVersionDocumentPK)
      ) {
        purposeVersionDocumentIdSet.add(purposeVersionDocumentPK);
        // eslint-disable-next-line functional/immutable-data
        purposeVersionDocumentsSQL.push(purposeVersionDocumentSQL);
      }

      const purposeVersionStampSQL = row.purposeVersionStamp;
      const purposeVersionStampPK = purposeVersionStampSQL
        ? makeUniqueKey([
            purposeVersionStampSQL.purposeVersionId,
            purposeVersionStampSQL.kind,
          ])
        : undefined;
      if (
        purposeVersionStampSQL &&
        purposeVersionStampPK &&
        !purposeVersionStampIdSet.has(purposeVersionStampPK)
      ) {
        purposeVersionStampIdSet.add(purposeVersionStampPK);
        // eslint-disable-next-line functional/immutable-data
        purposeVersionStampsSQL.push(purposeVersionStampSQL);
      }
    }
  });

  return {
    purposesSQL,
    riskAnalysisFormsSQL: purposeRiskAnalysisFormsSQL,
    riskAnalysisAnswersSQL: purposeRiskAnalysisAnswersSQL,
    versionsSQL: purposeVersionsSQL,
    versionDocumentsSQL: purposeVersionDocumentsSQL,
    versionStampsSQL: purposeVersionStampsSQL,
  };
};
