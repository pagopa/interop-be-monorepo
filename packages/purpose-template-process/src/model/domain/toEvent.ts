import {
  CorrelationId,
  PurposeTemplate,
  PurposeTemplateEventV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { CreateEvent } from "pagopa-interop-commons";

export function toCreateEventPurposeTemplateAdded(
  purposeTemplate: PurposeTemplate,
  correlationId: CorrelationId
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version: undefined,
    correlationId,
    event: {
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
    },
  };
}

export function toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded(
  purposeTemplate: PurposeTemplate,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  correlationId: CorrelationId
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version: undefined,
    correlationId,
    event: {
      type: "PurposeTemplateAnnotationDocumentAdded",
      event_version: 2,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        documentId,
      },
    },
  };
}
