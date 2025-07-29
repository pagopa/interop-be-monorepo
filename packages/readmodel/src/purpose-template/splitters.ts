import {
  dateToString,
  PurposeTemplate,
  PurposeTemplateId,
  riskAnalysisAnswerKind,
  RiskAnalysisFormTemplate,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";
import {
  PurposeTemplateEServiceDescriptorVersionSQL,
  PurposeTemplateItemsSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  PurposeTemplateRiskAnalysisAnswerSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";

export const splitPurposeTemplateIntoObjectsSQL = (
  {
    id,
    targetDescription,
    targetTenantKind,
    creatorId,
    eservicesVersions,
    state,
    createdAt,
    updatedAt,
    purposeTitle,
    purposeDescription,
    purposeRiskAnalysisForm,
    purposeIsFreeOfCharge,
    purposeFreeOfChargeReason,
    purposeDailyCalls,
    ...rest
  }: PurposeTemplate,
  version: number
): PurposeTemplateItemsSQL => {
  void (rest satisfies Record<string, never>);

  const purposeTemplateSQL: PurposeTemplateSQL = {
    id,
    metadataVersion: version,
    targetDescription,
    targetTenantKind,
    creatorId,
    state,
    createdAt: dateToString(createdAt),
    updatedAt: dateToString(updatedAt),
    purposeTitle,
    purposeDescription,
    purposeIsFreeOfCharge,
    purposeFreeOfChargeReason: purposeFreeOfChargeReason ?? null,
    purposeDailyCalls: purposeDailyCalls ?? null,
  };

  const eserviceDescriptorVersionsSQL: PurposeTemplateEServiceDescriptorVersionSQL[] =
    eservicesVersions.map((eserviceDescriptorVersion) => ({
      metadataVersion: version,
      purposeTemplateId: id,
      eserviceId: eserviceDescriptorVersion.eserviceId,
      descriptorId: eserviceDescriptorVersion.descriptorId,
    }));

  const splitPurposeRiskAnalysisSQL =
    splitRiskAnalysisTemplateFormIntoObjectsSQL(
      id,
      purposeRiskAnalysisForm,
      version
    );

  return {
    purposeTemplateSQL,
    eserviceDescriptorVersionsSQL,
    riskAnalysisFormTemplateSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswersSQL ?? [],
    riskAnalysisTemplateAnswerAnnotationsSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswerAnnotationsSQL ??
      [],
    riskAnalysisTemplateAnswerAnnotationDocumentsSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswerAnnotationDocumentsSQL ??
      [],
  };
};

const splitRiskAnalysisTemplateFormIntoObjectsSQL = (
  purposeTemplateId: PurposeTemplateId,
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate | undefined,
  metadataVersion: number
):
  | {
      riskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSQL;
      riskAnalysisTemplateAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
      riskAnalysisTemplateAnswerAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
      riskAnalysisTemplateAnswerAnnotationDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
    }
  | undefined => {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }

  const { id, version, singleAnswers, multiAnswers, ...rest } =
    riskAnalysisFormTemplate;
  void (rest satisfies Record<string, never>);

  const riskAnalysisFormTemplateSQL: PurposeTemplateRiskAnalysisFormSQL = {
    id,
    metadataVersion,
    purposeTemplateId,
    version,
  };

  const {
    riskAnalysisTemplateSingleAnswers,
    riskAnalysisTemplateSingleAnswersAnnotations,
    riskAnalysisTemplateSingleAnswersAnnotationDocuments,
  }: {
    riskAnalysisTemplateSingleAnswers: PurposeTemplateRiskAnalysisAnswerSQL[];
    riskAnalysisTemplateSingleAnswersAnnotations: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
    riskAnalysisTemplateSingleAnswersAnnotationDocuments: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
  } = singleAnswers.reduce(
    (
      acc,
      riskAnalysisTemplateSingleAnswer: RiskAnalysisTemplateSingleAnswer
    ) => {
      const {
        id,
        key,
        value,
        editable,
        annotation,
        assistiveText,
        suggestedValues,
        ...answerRest
      }: RiskAnalysisTemplateSingleAnswer = riskAnalysisTemplateSingleAnswer;

      void (answerRest satisfies Record<string, never>);

      const {
        riskAnalysisAnswerAnnotationSQL,
        riskAnalysisAnswerAnnotationDocumentsSQL,
      } = splitRiskAnalysisTemplateAnswerAnnotationsIntoObjectsSQL(
        annotation,
        id,
        purposeTemplateId,
        metadataVersion
      );

      return {
        riskAnalysisTemplateSingleAnswers: [
          ...acc.riskAnalysisTemplateSingleAnswers,
          {
            id,
            purposeTemplateId,
            metadataVersion,
            riskAnalysisFormId: riskAnalysisFormTemplate.id,
            kind: riskAnalysisAnswerKind.single,
            key,
            value: value ? [value] : [],
            editable,
            assistiveText: assistiveText ?? null,
            suggestedValues,
          },
        ],
        riskAnalysisTemplateSingleAnswersAnnotations: [
          ...acc.riskAnalysisTemplateSingleAnswersAnnotations,
          ...(riskAnalysisAnswerAnnotationSQL
            ? [riskAnalysisAnswerAnnotationSQL]
            : []),
        ],
        riskAnalysisTemplateSingleAnswersAnnotationDocuments: [
          ...acc.riskAnalysisTemplateSingleAnswersAnnotationDocuments,
          ...riskAnalysisAnswerAnnotationDocumentsSQL,
        ],
      };
    },
    {
      riskAnalysisTemplateSingleAnswers:
        new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
      riskAnalysisTemplateSingleAnswersAnnotations:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
      riskAnalysisTemplateSingleAnswersAnnotationDocuments:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
    }
  );

  const {
    riskAnalysisTemplateMultiAnswers,
    riskAnalysisTemplateMultiAnswersAnnotations,
    riskAnalysisTemplateMultiAnswersAnnotationDocuments,
  }: {
    riskAnalysisTemplateMultiAnswers: PurposeTemplateRiskAnalysisAnswerSQL[];
    riskAnalysisTemplateMultiAnswersAnnotations: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
    riskAnalysisTemplateMultiAnswersAnnotationDocuments: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
  } = multiAnswers.reduce(
    (acc, riskAnalysisTemplateMultiAnswer: RiskAnalysisTemplateMultiAnswer) => {
      const {
        id,
        key,
        values,
        editable,
        annotation,
        assistiveText,
        ...answerRest
      }: RiskAnalysisTemplateMultiAnswer = riskAnalysisTemplateMultiAnswer;

      void (answerRest satisfies Record<string, never>);

      const {
        riskAnalysisAnswerAnnotationSQL,
        riskAnalysisAnswerAnnotationDocumentsSQL,
      } = splitRiskAnalysisTemplateAnswerAnnotationsIntoObjectsSQL(
        annotation,
        id,
        purposeTemplateId,
        metadataVersion
      );

      return {
        riskAnalysisTemplateMultiAnswers: [
          ...acc.riskAnalysisTemplateMultiAnswers,
          {
            id,
            purposeTemplateId,
            metadataVersion,
            riskAnalysisFormId: riskAnalysisFormTemplate.id,
            kind: riskAnalysisAnswerKind.multi,
            key,
            value: values,
            editable,
            assistiveText: assistiveText ?? null,
            suggestedValues: null,
          },
        ],
        riskAnalysisTemplateMultiAnswersAnnotations: [
          ...acc.riskAnalysisTemplateMultiAnswersAnnotations,
          ...(riskAnalysisAnswerAnnotationSQL
            ? [riskAnalysisAnswerAnnotationSQL]
            : []),
        ],
        riskAnalysisTemplateMultiAnswersAnnotationDocuments: [
          ...acc.riskAnalysisTemplateMultiAnswersAnnotationDocuments,
          ...riskAnalysisAnswerAnnotationDocumentsSQL,
        ],
      };
    },
    {
      riskAnalysisTemplateMultiAnswers:
        new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
      riskAnalysisTemplateMultiAnswersAnnotations:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
      riskAnalysisTemplateMultiAnswersAnnotationDocuments:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
    }
  );

  return {
    riskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL: [
      ...riskAnalysisTemplateSingleAnswers,
      ...riskAnalysisTemplateMultiAnswers,
    ],
    riskAnalysisTemplateAnswerAnnotationsSQL: [
      ...riskAnalysisTemplateSingleAnswersAnnotations,
      ...riskAnalysisTemplateMultiAnswersAnnotations,
    ],
    riskAnalysisTemplateAnswerAnnotationDocumentsSQL: [
      ...riskAnalysisTemplateSingleAnswersAnnotationDocuments,
      ...riskAnalysisTemplateMultiAnswersAnnotationDocuments,
    ],
  };
};

const splitRiskAnalysisTemplateAnswerAnnotationsIntoObjectsSQL = (
  riskAnalysisAnswerAnnotation:
    | RiskAnalysisTemplateAnswerAnnotation
    | undefined,
  riskAnalysisAnswerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId,
  purposeTemplateId: PurposeTemplateId,
  metadataVersion: number
): {
  riskAnalysisAnswerAnnotationSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL | null;
  riskAnalysisAnswerAnnotationDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
} => {
  if (!riskAnalysisAnswerAnnotation) {
    return {
      riskAnalysisAnswerAnnotationSQL: null,
      riskAnalysisAnswerAnnotationDocumentsSQL: [],
    };
  }

  const riskAnalysisAnswerAnnotationSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL =
    {
      id: riskAnalysisAnswerAnnotation.id,
      purposeTemplateId,
      metadataVersion,
      answerId: riskAnalysisAnswerId,
      text: riskAnalysisAnswerAnnotation.text ?? null,
    };

  const riskAnalysisAnswerAnnotationDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[] =
    riskAnalysisAnswerAnnotation.docs
      ? riskAnalysisAnswerAnnotation.docs.map((doc) => ({
          id: doc.id,
          purposeTemplateId,
          metadataVersion,
          annotationId: riskAnalysisAnswerAnnotation.id,
          name: doc.name,
          contentType: doc.contentType,
          path: doc.path,
          createdAt: dateToString(doc.createdAt),
        }))
      : [];

  return {
    riskAnalysisAnswerAnnotationSQL,
    riskAnalysisAnswerAnnotationDocumentsSQL,
  };
};
