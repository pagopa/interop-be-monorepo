import {
  CorrelationId,
  PurposeTemplate,
  PurposeTemplateEventV2,
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

export function toCreateEventPurposeTemplateUnsuspended({
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
      type: "PurposeTemplateUnsuspended",
      event_version: 2,
      data: { purposeTemplate: toPurposeTemplateV2(purposeTemplate) },
    },
  };
}
