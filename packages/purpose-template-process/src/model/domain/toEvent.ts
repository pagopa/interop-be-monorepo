import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  PurposeTemplate,
  PurposeTemplateEventV2,
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

export function toCreateEventPurposeTemplateDraftUpdated({
  purposeTemplate,
  correlationId,
  version,
}: {
  purposeTemplate: PurposeTemplate;
  correlationId: CorrelationId;
  version: number;
}): CreateEvent<PurposeTemplateEventV2> {
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
