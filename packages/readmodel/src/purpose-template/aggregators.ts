/* eslint-disable sonarjs/no-collapsible-if */
import {
  PurposeTemplateItemsSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  PurposeTemplateRiskAnalysisAnswerSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";
import {
  genericInternalError,
  PurposeTemplate,
  PurposeTemplateState,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisFormTemplate,
  RiskAnalysisFormTemplateId,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  TenantKind,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

// Helper function to add unique items to arrays
function addUniqueItem<T extends { id: string; purposeTemplateId: string }>(
  item: T | null,
  idSet: Set<string>,
  array: T[]
): void {
  if (!item) {
    return;
  }

  const uniqueKey = makeUniqueKey([item.id, item.purposeTemplateId]);
  if (!idSet.has(uniqueKey)) {
    idSet.add(uniqueKey);
    // eslint-disable-next-line functional/immutable-data
    array.push(item);
  }
}

// Helper function to add simple unique items (only id)
function addUniqueSimpleItem<T extends { id: string }>(
  item: T | null,
  idSet: Set<string>,
  array: T[]
): void {
  if (!item) {
    return;
  }

  if (!idSet.has(item.id)) {
    idSet.add(item.id);
    // eslint-disable-next-line functional/immutable-data
    array.push(item);
  }
}

const purposeTemplateRiskAnalysisFormSQLToPurposeRiskAnalysisForm = (
  riskAnalysisFormSQL: PurposeTemplateRiskAnalysisFormSQL | undefined,
  answers: PurposeTemplateRiskAnalysisAnswerSQL[] | undefined
): RiskAnalysisFormTemplate | undefined => {
  if (!riskAnalysisFormSQL) {
    return undefined;
  }

  if (!answers) {
    throw genericInternalError(
      `Purpose template risk analysis form with id ${riskAnalysisFormSQL.id} found without answers`
    );
  }

  const { singleAnswers, multiAnswers } = answers.reduce<{
    singleAnswers: RiskAnalysisTemplateSingleAnswer[];
    multiAnswers: RiskAnalysisTemplateMultiAnswer[];
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
              editable: a.editable,
              suggestedValues: a.suggestedValues || [],
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
              editable: a.editable,
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
    id: unsafeBrandId<RiskAnalysisFormTemplateId>(riskAnalysisFormSQL.id),
    version: riskAnalysisFormSQL.version,
    singleAnswers,
    multiAnswers,
  };
};

export const aggregatePurposeTemplate = ({
  purposeTemplateSQL,
  riskAnalysisFormTemplateSQL,
  riskAnalysisTemplateAnswersSQL,
  riskAnalysisTemplateAnswersAnnotationsSQL:
    _riskAnalysisTemplateAnswersAnnotationsSQL,
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
    _riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
}: PurposeTemplateItemsSQL): WithMetadata<PurposeTemplate> => {
  const riskAnalysisForm =
    purposeTemplateRiskAnalysisFormSQLToPurposeRiskAnalysisForm(
      riskAnalysisFormTemplateSQL,
      riskAnalysisTemplateAnswersSQL
    );

  const purposeTemplate: PurposeTemplate = {
    id: unsafeBrandId(purposeTemplateSQL.id),
    targetDescription: purposeTemplateSQL.targetDescription,
    targetTenantKind: TenantKind.parse(purposeTemplateSQL.targetTenantKind),
    creatorId: unsafeBrandId(purposeTemplateSQL.creatorId),
    state: PurposeTemplateState.parse(purposeTemplateSQL.state),
    createdAt: new Date(purposeTemplateSQL.createdAt),
    purposeTitle: purposeTemplateSQL.purposeTitle,
    purposeDescription: purposeTemplateSQL.purposeDescription,
    purposeIsFreeOfCharge: purposeTemplateSQL.purposeIsFreeOfCharge,
    ...(riskAnalysisForm ? { purposeRiskAnalysisForm: riskAnalysisForm } : {}),
    ...(purposeTemplateSQL.purposeFreeOfChargeReason
      ? {
          purposeFreeOfChargeReason:
            purposeTemplateSQL.purposeFreeOfChargeReason,
        }
      : {}),
    ...(purposeTemplateSQL.purposeDailyCalls
      ? { purposeDailyCalls: purposeTemplateSQL.purposeDailyCalls }
      : {}),
    ...(purposeTemplateSQL.updatedAt
      ? { updatedAt: new Date(purposeTemplateSQL.updatedAt) }
      : {}),
  };

  return {
    data: purposeTemplate,
    metadata: { version: purposeTemplateSQL.metadataVersion },
  };
};

export const toPurposeTemplateAggregator = (
  queryRes: Array<{
    purposeTemplate: PurposeTemplateSQL;
    purposeTemplateRiskAnalysisForm: PurposeTemplateRiskAnalysisFormSQL | null;
    purposeTemplateRiskAnalysisAnswer: PurposeTemplateRiskAnalysisAnswerSQL | null;
    purposeTemplateRiskAnalysisAnswerAnnotation: PurposeTemplateRiskAnalysisAnswerAnnotationSQL | null;
    purposeTemplateRiskAnalysisAnswerAnnotationDocument: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL | null;
  }>
): PurposeTemplateItemsSQL => {
  const {
    purposeTemplatesSQL,
    riskAnalysisFormsTemplateSQL,
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  } = toPurposeTemplateAggregatorArray(queryRes);

  throwIfMultiple(purposeTemplatesSQL, "purposeTemplate");

  return {
    purposeTemplateSQL: purposeTemplatesSQL[0],
    riskAnalysisFormTemplateSQL: riskAnalysisFormsTemplateSQL[0],
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  };
};

export const toPurposeTemplateAggregatorArray = (
  queryRes: Array<{
    purposeTemplate: PurposeTemplateSQL;
    purposeTemplateRiskAnalysisForm: PurposeTemplateRiskAnalysisFormSQL | null;
    purposeTemplateRiskAnalysisAnswer: PurposeTemplateRiskAnalysisAnswerSQL | null;
    purposeTemplateRiskAnalysisAnswerAnnotation: PurposeTemplateRiskAnalysisAnswerAnnotationSQL | null;
    purposeTemplateRiskAnalysisAnswerAnnotationDocument: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL | null;
  }>
): {
  purposeTemplatesSQL: PurposeTemplateSQL[];
  riskAnalysisFormsTemplateSQL: PurposeTemplateRiskAnalysisFormSQL[];
  riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
  riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
} => {
  const purposeTemplateIdSet = new Set<string>();
  const purposeTemplatesSQL: PurposeTemplateSQL[] = [];

  const riskAnalysisFormIdSet = new Set<string>();
  const riskAnalysisFormsTemplateSQL: PurposeTemplateRiskAnalysisFormSQL[] = [];

  const riskAnalysisAnswerIdSet = new Set<string>();
  const riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[] =
    [];

  const riskAnalysisAnswerAnnotationIdSet = new Set<string>();
  const riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[] =
    [];

  const riskAnalysisAnswerAnnotationDocumentIdSet = new Set<string>();
  const riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[] =
    [];

  queryRes.forEach((row) => {
    addUniqueSimpleItem(
      row.purposeTemplate,
      purposeTemplateIdSet,
      purposeTemplatesSQL
    );
    addUniqueItem(
      row.purposeTemplateRiskAnalysisForm,
      riskAnalysisFormIdSet,
      riskAnalysisFormsTemplateSQL
    );
    addUniqueItem(
      row.purposeTemplateRiskAnalysisAnswer,
      riskAnalysisAnswerIdSet,
      riskAnalysisTemplateAnswersSQL
    );
    addUniqueItem(
      row.purposeTemplateRiskAnalysisAnswerAnnotation,
      riskAnalysisAnswerAnnotationIdSet,
      riskAnalysisTemplateAnswersAnnotationsSQL
    );
    addUniqueItem(
      row.purposeTemplateRiskAnalysisAnswerAnnotationDocument,
      riskAnalysisAnswerAnnotationDocumentIdSet,
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL
    );
  });

  return {
    purposeTemplatesSQL,
    riskAnalysisFormsTemplateSQL,
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  };
};
