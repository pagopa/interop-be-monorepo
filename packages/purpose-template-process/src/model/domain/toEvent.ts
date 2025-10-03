import {
  CorrelationId,
  dateToBigInt,
  EService,
  EServiceDescriptorPurposeTemplate,
  PurposeTemplate,
  PurposeTemplateEventV2,
  toEServiceV2,
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

export function toCreateEventPurposeTemplatePublished({
  purposeTemplate,
  version,
  correlationId,
}: {
  purposeTemplate: PurposeTemplate;
  version: number;
  correlationId: CorrelationId;
}): CreateEvent<PurposeTemplateEventV2> {
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
