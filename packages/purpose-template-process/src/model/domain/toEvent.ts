import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  dateToBigInt,
  EService,
  EServiceDescriptorPurposeTemplate,
  PurposeTemplate,
  PurposeTemplateEventV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  toEServiceV2,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  toPurposeTemplateV2,
} from "pagopa-interop-models";

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

export function toCreateEventPurposeTemplateEServiceLinked(
  eServiceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate,
  purposeTemplate: PurposeTemplate,
  eservice: EService,
  correlationId: CorrelationId,
  version: number
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: eServiceDescriptorPurposeTemplate.purposeTemplateId,
    version,
    correlationId,
    event: {
      type: "PurposeTemplateEServiceLinked",
      event_version: 2,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: eServiceDescriptorPurposeTemplate.descriptorId,
        createdAt: dateToBigInt(eServiceDescriptorPurposeTemplate.createdAt),
      },
    },
  };
}

export function toCreateEventPurposeTemplateEServiceUnlinked(
  eServiceDescriptorPurposeTemplate: EServiceDescriptorPurposeTemplate,
  purposeTemplate: PurposeTemplate,
  eservice: EService,
  correlationId: CorrelationId,
  version: number
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: eServiceDescriptorPurposeTemplate.purposeTemplateId,
    version,
    correlationId,
    event: {
      type: "PurposeTemplateEServiceUnlinked",
      event_version: 2,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: eServiceDescriptorPurposeTemplate.descriptorId,
      },
    },
  };
}

export function toCreateEventPurposeTemplateDraftUpdated(
  purposeTemplate: PurposeTemplate,
  correlationId: CorrelationId,
  version: number
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version,
    correlationId,
    event: {
      type: "PurposeTemplateDraftUpdated",
      event_version: 2,
      data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
    },
  };
}

export function toCreateEventPurposeTemplateAnswerAnnotationDocumentAdded(
  purposeTemplate: PurposeTemplate,
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId,
  version: number,
  correlationId: CorrelationId
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version,
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

export function toCreateEventPurposeTemplatePublished(
  purposeTemplate: PurposeTemplate,
  version: number,
  correlationId: CorrelationId
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version,
    correlationId,
    event: {
      type: "PurposeTemplatePublished",
      event_version: 2,
      data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
    },
  };
}

export function toCreateEventPurposeTemplateDraftDeleted(
  purposeTemplate: PurposeTemplate,
  correlationId: CorrelationId,
  version: number
): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version,
    correlationId,
    event: {
      type: "PurposeTemplateDraftDeleted",
      event_version: 2,
      data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
    },
  };
}

export function toCreateEventPurposeTemplateAnnotationDocumentDeleted({
  purposeTemplate,
  documentId,
  correlationId,
  version,
}: {
  purposeTemplate: PurposeTemplate;
  documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId;
  correlationId: CorrelationId;
  version: number;
}): CreateEvent<PurposeTemplateEventV2> {
  return {
    streamId: purposeTemplate.id,
    version,
    correlationId,
    event: {
      type: "PurposeTemplateAnnotationDocumentDeleted",
      event_version: 2,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        documentId,
      },
    },
  };
}
