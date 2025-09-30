import {
  PurposeTemplate,
  PurposeTemplateId,
  PurposeTemplateState,
  RiskAnalysisAnswerKind,
  riskAnalysisAnswerKind,
  RiskAnalysisFormTemplate,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationId,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  stringToDate,
  TenantKind,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  PurposeTemplateRiskAnalysisAnswerSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateItemsSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";
import { throwIfMultiple } from "../utils.js";

export const aggregatePurposeTemplateArray = ({
  purposeTemplatesSQL,
  riskAnalysisFormTemplatesSQL,
  riskAnalysisTemplateAnswersSQL,
  riskAnalysisTemplateAnswersAnnotationsSQL,
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
}: {
  purposeTemplatesSQL: PurposeTemplateSQL[];
  riskAnalysisFormTemplatesSQL: PurposeTemplateRiskAnalysisFormSQL[];
  riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
  riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
}): Array<WithMetadata<PurposeTemplate>> => {
  const riskAnalysisFormTemplateByPurposeTemplateId =
    createPurposeTemplateSQLPropertyMap(riskAnalysisFormTemplatesSQL);
  const riskAnalysisTemplateAnswersByPurposeTemplateId =
    createPurposeTemplateSQLPropertyMap(riskAnalysisTemplateAnswersSQL);
  const riskAnalysisTemplateAnswerAnnotationsByPurposeTemplateId =
    createPurposeTemplateSQLPropertyMap(
      riskAnalysisTemplateAnswersAnnotationsSQL
    );
  const riskAnalysisTemplateAnswerAnnotationDocumentsByPurposeTemplateId =
    createPurposeTemplateSQLPropertyMap(
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL
    );

  return purposeTemplatesSQL.map((purposeTemplateSQL) => {
    const purposeTemplateId = unsafeBrandId<PurposeTemplateId>(
      purposeTemplateSQL.id
    );
    return aggregatePurposeTemplate({
      purposeTemplateSQL,
      riskAnalysisFormTemplateSQL:
        riskAnalysisFormTemplateByPurposeTemplateId.get(purposeTemplateId)?.[0],
      riskAnalysisTemplateAnswersSQL:
        riskAnalysisTemplateAnswersByPurposeTemplateId.get(purposeTemplateId) ||
        [],
      riskAnalysisTemplateAnswersAnnotationsSQL:
        riskAnalysisTemplateAnswerAnnotationsByPurposeTemplateId.get(
          purposeTemplateId
        ) || [],
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
        riskAnalysisTemplateAnswerAnnotationDocumentsByPurposeTemplateId.get(
          purposeTemplateId
        ) || [],
    });
  });
};

const createPurposeTemplateSQLPropertyMap = <
  T extends
    | PurposeTemplateRiskAnalysisFormSQL
    | PurposeTemplateRiskAnalysisAnswerSQL
    | PurposeTemplateRiskAnalysisAnswerAnnotationSQL
    | PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL
>(
  items: T[]
): Map<PurposeTemplateId, T[]> =>
  items.reduce((acc, item) => {
    const purposeTemplateId = unsafeBrandId<PurposeTemplateId>(
      item.purposeTemplateId
    );
    const values = acc.get(purposeTemplateId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(purposeTemplateId, values);

    return acc;
  }, new Map<PurposeTemplateId, T[]>());

export const aggregatePurposeTemplate = ({
  purposeTemplateSQL,
  riskAnalysisFormTemplateSQL,
  riskAnalysisTemplateAnswersSQL,
  riskAnalysisTemplateAnswersAnnotationsSQL,
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
}: PurposeTemplateItemsSQL): WithMetadata<PurposeTemplate> => {
  const purposeRiskAnalysisForm = aggregatePurposeTemplateRiskAnalysisForm({
    riskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  });

  const purposeTemplate: PurposeTemplate = {
    id: unsafeBrandId(purposeTemplateSQL.id),
    targetDescription: purposeTemplateSQL.targetDescription,
    targetTenantKind: TenantKind.parse(purposeTemplateSQL.targetTenantKind),
    creatorId: unsafeBrandId(purposeTemplateSQL.creatorId),
    state: PurposeTemplateState.parse(purposeTemplateSQL.state),
    createdAt: stringToDate(purposeTemplateSQL.createdAt),
    ...(purposeTemplateSQL.updatedAt
      ? { updatedAt: stringToDate(purposeTemplateSQL.updatedAt) }
      : {}),
    purposeTitle: purposeTemplateSQL.purposeTitle,
    purposeDescription: purposeTemplateSQL.purposeDescription,
    ...(purposeRiskAnalysisForm
      ? {
          purposeRiskAnalysisForm,
        }
      : {}),
    purposeIsFreeOfCharge: purposeTemplateSQL.purposeIsFreeOfCharge,
    ...(purposeTemplateSQL.purposeFreeOfChargeReason
      ? {
          purposeFreeOfChargeReason:
            purposeTemplateSQL.purposeFreeOfChargeReason,
        }
      : {}),
    ...(purposeTemplateSQL.purposeDailyCalls
      ? { purposeDailyCalls: purposeTemplateSQL.purposeDailyCalls }
      : {}),
  };

  return {
    data: purposeTemplate,
    metadata: {
      version: purposeTemplateSQL.metadataVersion,
    },
  };
};

export const aggregatePurposeTemplateRiskAnalysisForm = ({
  riskAnalysisFormTemplateSQL,
  riskAnalysisTemplateAnswersSQL,
  riskAnalysisTemplateAnswersAnnotationsSQL,
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
}: {
  riskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSQL | undefined;
  riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
  riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
}): RiskAnalysisFormTemplate | undefined => {
  if (!riskAnalysisFormTemplateSQL) {
    return undefined;
  }

  const riskAnalysisTemplateAnswersAnnotationsByAnswerId =
    riskAnalysisTemplateAnswersAnnotationsSQL.reduce((acc, annotationSQL) => {
      const answerId = unsafeBrandId<
        RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
      >(annotationSQL.answerId);
      acc.set(answerId, annotationSQL);

      return acc;
    }, new Map<RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId, PurposeTemplateRiskAnalysisAnswerAnnotationSQL>());

  const riskAnalysisTemplateAnswersAnnotationsDocumentsByAnnotationId =
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL.reduce(
      (acc, documentSQL) => {
        const annotationId =
          unsafeBrandId<RiskAnalysisTemplateAnswerAnnotationId>(
            documentSQL.annotationId
          );
        const documentsSQL = acc.get(annotationId) || [];
        // eslint-disable-next-line functional/immutable-data
        documentsSQL.push(documentSQL);
        acc.set(annotationId, documentsSQL);

        return acc;
      },
      new Map<
        RiskAnalysisTemplateAnswerAnnotationId,
        PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[]
      >()
    );

  const {
    riskAnalysisTemplateSingleAnswers,
    riskAnalysisTemplateMultiAnswers,
  } = riskAnalysisTemplateAnswersSQL.reduce(
    (acc, answerSQL) => {
      const answerId = unsafeBrandId<
        RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
      >(answerSQL.id);
      const annotationSQL =
        riskAnalysisTemplateAnswersAnnotationsByAnswerId.get(answerId);

      const annotationDocumentSQL = annotationSQL
        ? riskAnalysisTemplateAnswersAnnotationsDocumentsByAnnotationId.get(
            unsafeBrandId(annotationSQL.id)
          )
        : undefined;

      const answerAnnotation: RiskAnalysisTemplateAnswerAnnotation | undefined =
        annotationSQL
          ? {
              id: unsafeBrandId(annotationSQL.id),
              text: annotationSQL.text,
              docs: annotationDocumentSQL
                ? annotationDocumentSQL.map(
                    toRiskAnalysisTemplateAnswerAnnotationDocument
                  )
                : [],
            }
          : undefined;

      return match(RiskAnalysisAnswerKind.parse(answerSQL.kind))
        .with(riskAnalysisAnswerKind.single, () => ({
          riskAnalysisTemplateSingleAnswers: [
            ...acc.riskAnalysisTemplateSingleAnswers,
            {
              id: unsafeBrandId(answerSQL.id),
              key: answerSQL.key,
              ...(answerSQL.value[0] ? { value: answerSQL.value[0] } : {}),
              editable: answerSQL.editable,
              ...(answerAnnotation ? { annotation: answerAnnotation } : {}),
              suggestedValues: answerSQL.suggestedValues || [],
            } satisfies RiskAnalysisTemplateSingleAnswer,
          ],
          riskAnalysisTemplateMultiAnswers:
            acc.riskAnalysisTemplateMultiAnswers,
        }))
        .with(riskAnalysisAnswerKind.multi, () => ({
          riskAnalysisTemplateSingleAnswers:
            acc.riskAnalysisTemplateSingleAnswers,
          riskAnalysisTemplateMultiAnswers: [
            ...acc.riskAnalysisTemplateMultiAnswers,
            {
              id: unsafeBrandId(answerSQL.id),
              key: answerSQL.key,
              values: answerSQL.value,
              editable: answerSQL.editable,
              ...(answerAnnotation ? { annotation: answerAnnotation } : {}),
            } satisfies RiskAnalysisTemplateMultiAnswer,
          ],
        }))
        .exhaustive();
    },
    {
      riskAnalysisTemplateSingleAnswers:
        new Array<RiskAnalysisTemplateSingleAnswer>(),
      riskAnalysisTemplateMultiAnswers:
        new Array<RiskAnalysisTemplateMultiAnswer>(),
    }
  );

  return {
    id: unsafeBrandId(riskAnalysisFormTemplateSQL.id),
    version: riskAnalysisFormTemplateSQL.version,
    singleAnswers: riskAnalysisTemplateSingleAnswers,
    multiAnswers: riskAnalysisTemplateMultiAnswers,
  };
};

export const toPurposeTemplateAggregator = (
  queryRes: Array<{
    purposeTemplate: PurposeTemplateSQL;
    purposeRiskAnalysisFormTemplate: PurposeTemplateRiskAnalysisFormSQL | null;
    purposeRiskAnalysisTemplateAnswer: PurposeTemplateRiskAnalysisAnswerSQL | null;
    purposeRiskAnalysisTemplateAnswerAnnotation: PurposeTemplateRiskAnalysisAnswerAnnotationSQL | null;
    purposeRiskAnalysisTemplateAnswerAnnotationDocument: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL | null;
  }>
): PurposeTemplateItemsSQL => {
  const {
    purposeTemplatesSQL,
    riskAnalysisFormTemplatesSQL,
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  } = toPurposeTemplateAggregatorArray(queryRes);

  throwIfMultiple(purposeTemplatesSQL, "purpose template");

  return {
    purposeTemplateSQL: purposeTemplatesSQL[0],
    riskAnalysisFormTemplateSQL: riskAnalysisFormTemplatesSQL[0],
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  };
};

export const toPurposeTemplateAggregatorArray = (
  queryRes: Array<{
    purposeTemplate: PurposeTemplateSQL;
    purposeRiskAnalysisFormTemplate: PurposeTemplateRiskAnalysisFormSQL | null;
    purposeRiskAnalysisTemplateAnswer: PurposeTemplateRiskAnalysisAnswerSQL | null;
    purposeRiskAnalysisTemplateAnswerAnnotation: PurposeTemplateRiskAnalysisAnswerAnnotationSQL | null;
    purposeRiskAnalysisTemplateAnswerAnnotationDocument: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL | null;
  }>
): {
  purposeTemplatesSQL: PurposeTemplateSQL[];
  riskAnalysisFormTemplatesSQL: PurposeTemplateRiskAnalysisFormSQL[];
  riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
  riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
} => {
  const purposeTemplateIdsSet = new Set<string>();
  const purposeTemplatesSQL: PurposeTemplateSQL[] = [];

  const riskAnalysisFormTemplateIdsSet = new Set<string>();
  const riskAnalysisFormTemplatesSQL: PurposeTemplateRiskAnalysisFormSQL[] = [];

  const riskAnalysisTemplateAnswerIdsSet = new Set<string>();
  const riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[] =
    [];

  const riskAnalysisTemplateAnswerAnnotationsIdsSet = new Set<string>();
  const riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[] =
    [];

  const riskAnalysisTemplateAnswerAnnotationsDocumentsIdsSet =
    new Set<string>();
  const riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[] =
    [];

  queryRes.forEach((row) => {
    const purposeTemplateSQL = row.purposeTemplate;
    if (!purposeTemplateIdsSet.has(purposeTemplateSQL.id)) {
      purposeTemplateIdsSet.add(purposeTemplateSQL.id);
      // eslint-disable-next-line functional/immutable-data
      purposeTemplatesSQL.push(purposeTemplateSQL);
    }

    const riskAnalysisFormTemplateSQL = row.purposeRiskAnalysisFormTemplate;
    if (
      riskAnalysisFormTemplateSQL &&
      !riskAnalysisFormTemplateIdsSet.has(riskAnalysisFormTemplateSQL.id)
    ) {
      riskAnalysisFormTemplateIdsSet.add(riskAnalysisFormTemplateSQL.id);
      // eslint-disable-next-line functional/immutable-data
      riskAnalysisFormTemplatesSQL.push(riskAnalysisFormTemplateSQL);
    }

    const riskAnalysisTemplateAnswerSQL = row.purposeRiskAnalysisTemplateAnswer;
    if (
      riskAnalysisTemplateAnswerSQL &&
      !riskAnalysisTemplateAnswerIdsSet.has(riskAnalysisTemplateAnswerSQL.id)
    ) {
      riskAnalysisTemplateAnswerIdsSet.add(riskAnalysisTemplateAnswerSQL.id);
      // eslint-disable-next-line functional/immutable-data
      riskAnalysisTemplateAnswersSQL.push(riskAnalysisTemplateAnswerSQL);
    }

    const riskAnalysisTemplateAnswerAnnotationSQL =
      row.purposeRiskAnalysisTemplateAnswerAnnotation;
    if (
      riskAnalysisTemplateAnswerAnnotationSQL &&
      !riskAnalysisTemplateAnswerAnnotationsIdsSet.has(
        riskAnalysisTemplateAnswerAnnotationSQL.id
      )
    ) {
      riskAnalysisTemplateAnswerAnnotationsIdsSet.add(
        riskAnalysisTemplateAnswerAnnotationSQL.id
      );
      // eslint-disable-next-line functional/immutable-data
      riskAnalysisTemplateAnswersAnnotationsSQL.push(
        riskAnalysisTemplateAnswerAnnotationSQL
      );
    }

    const riskAnalysisTemplateAnswerAnnotationDocumentSQL =
      row.purposeRiskAnalysisTemplateAnswerAnnotationDocument;
    if (
      riskAnalysisTemplateAnswerAnnotationDocumentSQL &&
      !riskAnalysisTemplateAnswerAnnotationsDocumentsIdsSet.has(
        riskAnalysisTemplateAnswerAnnotationDocumentSQL.id
      )
    ) {
      riskAnalysisTemplateAnswerAnnotationsDocumentsIdsSet.add(
        riskAnalysisTemplateAnswerAnnotationDocumentSQL.id
      );
      // eslint-disable-next-line functional/immutable-data
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL.push(
        riskAnalysisTemplateAnswerAnnotationDocumentSQL
      );
    }
  });

  return {
    purposeTemplatesSQL,
    riskAnalysisFormTemplatesSQL,
    riskAnalysisTemplateAnswersSQL,
    riskAnalysisTemplateAnswersAnnotationsSQL,
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
  };
};

export const toRiskAnalysisTemplateAnswerAnnotationDocument = (
  docSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL
): RiskAnalysisTemplateAnswerAnnotationDocument => ({
  id: unsafeBrandId(docSQL.id),
  name: docSQL.name,
  prettyName: docSQL.prettyName,
  contentType: docSQL.contentType,
  path: docSQL.path,
  createdAt: stringToDate(docSQL.createdAt),
});
