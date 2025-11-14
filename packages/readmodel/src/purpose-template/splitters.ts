import {
  dateToString,
  EServiceDescriptorPurposeTemplate,
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
  PurposeTemplateEServiceDescriptorSQL,
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
    state,
    createdAt,
    updatedAt,
    purposeTitle,
    purposeDescription,
    purposeRiskAnalysisForm,
    purposeIsFreeOfCharge,
    purposeFreeOfChargeReason,
    purposeDailyCalls,
    handlesPersonalData,
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
    handlesPersonalData,
  };

  const splitPurposeRiskAnalysisSQL =
    splitRiskAnalysisTemplateFormIntoObjectsSQL(
      id,
      purposeRiskAnalysisForm,
      version
    );

  return {
    purposeTemplateSQL,
    riskAnalysisFormTemplateSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswersSQL ?? [],
    riskAnalysisTemplateAnswersAnnotationsSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswersAnnotationsSQL ??
      [],
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL:
      splitPurposeRiskAnalysisSQL?.riskAnalysisTemplateAnswersAnnotationsDocumentsSQL ??
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
      riskAnalysisTemplateAnswersAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
      riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
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
    riskAnalysisTemplateSingleAnswersAnnotationsDocuments,
  }: {
    riskAnalysisTemplateSingleAnswers: PurposeTemplateRiskAnalysisAnswerSQL[];
    riskAnalysisTemplateSingleAnswersAnnotations: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
    riskAnalysisTemplateSingleAnswersAnnotationsDocuments: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
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
            suggestedValues,
          },
        ],
        riskAnalysisTemplateSingleAnswersAnnotations: [
          ...acc.riskAnalysisTemplateSingleAnswersAnnotations,
          ...(riskAnalysisAnswerAnnotationSQL
            ? [riskAnalysisAnswerAnnotationSQL]
            : []),
        ],
        riskAnalysisTemplateSingleAnswersAnnotationsDocuments: [
          ...acc.riskAnalysisTemplateSingleAnswersAnnotationsDocuments,
          ...riskAnalysisAnswerAnnotationDocumentsSQL,
        ],
      };
    },
    {
      riskAnalysisTemplateSingleAnswers:
        new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
      riskAnalysisTemplateSingleAnswersAnnotations:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
      riskAnalysisTemplateSingleAnswersAnnotationsDocuments:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
    }
  );

  const {
    riskAnalysisTemplateMultiAnswers,
    riskAnalysisTemplateMultiAnswersAnnotations,
    riskAnalysisTemplateMultiAnswersAnnotationsDocuments,
  }: {
    riskAnalysisTemplateMultiAnswers: PurposeTemplateRiskAnalysisAnswerSQL[];
    riskAnalysisTemplateMultiAnswersAnnotations: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
    riskAnalysisTemplateMultiAnswersAnnotationsDocuments: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
  } = multiAnswers.reduce(
    (acc, riskAnalysisTemplateMultiAnswer: RiskAnalysisTemplateMultiAnswer) => {
      const {
        id,
        key,
        values,
        editable,
        annotation,
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
            suggestedValues: null,
          },
        ],
        riskAnalysisTemplateMultiAnswersAnnotations: [
          ...acc.riskAnalysisTemplateMultiAnswersAnnotations,
          ...(riskAnalysisAnswerAnnotationSQL
            ? [riskAnalysisAnswerAnnotationSQL]
            : []),
        ],
        riskAnalysisTemplateMultiAnswersAnnotationsDocuments: [
          ...acc.riskAnalysisTemplateMultiAnswersAnnotationsDocuments,
          ...riskAnalysisAnswerAnnotationDocumentsSQL,
        ],
      };
    },
    {
      riskAnalysisTemplateMultiAnswers:
        new Array<PurposeTemplateRiskAnalysisAnswerSQL>(),
      riskAnalysisTemplateMultiAnswersAnnotations:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationSQL>(),
      riskAnalysisTemplateMultiAnswersAnnotationsDocuments:
        new Array<PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL>(),
    }
  );

  return {
    riskAnalysisFormTemplateSQL,
    riskAnalysisTemplateAnswersSQL: [
      ...riskAnalysisTemplateSingleAnswers,
      ...riskAnalysisTemplateMultiAnswers,
    ],
    riskAnalysisTemplateAnswersAnnotationsSQL: [
      ...riskAnalysisTemplateSingleAnswersAnnotations,
      ...riskAnalysisTemplateMultiAnswersAnnotations,
    ],
    riskAnalysisTemplateAnswersAnnotationsDocumentsSQL: [
      ...riskAnalysisTemplateSingleAnswersAnnotationsDocuments,
      ...riskAnalysisTemplateMultiAnswersAnnotationsDocuments,
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
          prettyName: doc.prettyName,
          contentType: doc.contentType,
          checksum: doc.checksum,
          path: doc.path,
          createdAt: dateToString(doc.createdAt),
        }))
      : [];

  return {
    riskAnalysisAnswerAnnotationSQL,
    riskAnalysisAnswerAnnotationDocumentsSQL,
  };
};

export const toPurposeTemplateEServiceDescriptorSQL = (
  purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate,
  metadataVersion: number
): PurposeTemplateEServiceDescriptorSQL => ({
  metadataVersion,
  purposeTemplateId: purposeTemplateEServiceDescriptor.purposeTemplateId,
  eserviceId: purposeTemplateEServiceDescriptor.eserviceId,
  descriptorId: purposeTemplateEServiceDescriptor.descriptorId,
  createdAt: dateToString(purposeTemplateEServiceDescriptor.createdAt),
});
