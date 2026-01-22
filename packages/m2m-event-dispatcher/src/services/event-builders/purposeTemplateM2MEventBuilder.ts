/* eslint-disable max-params */
import {
  PurposeTemplate,
  PurposeTemplateM2MEvent,
  purposeTemplateState,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";

/**
 * Crea un nuovo evento M2M per PurposeTemplate.
 * Include i campi opzionali per le relazioni con EService e Descriptor.
 */
export async function createPurposeTemplateM2MEvent(
  purposeTemplate: PurposeTemplate,
  resourceVersion: number,
  eventType: PurposeTemplateM2MEvent["eventType"],
  eventTimestamp: Date,
): Promise<PurposeTemplateM2MEvent> {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    purposeTemplateId: purposeTemplate.id,
    creatorId: purposeTemplate.creatorId,
    visibility: getPurposeTemplateM2MEventVisibility(
      eventType,
      purposeTemplate
    ),
  };
}

function getPurposeTemplateM2MEventVisibility(
  eventType: PurposeTemplateM2MEvent["eventType"],
  purposeTemplate: PurposeTemplate
): PurposeTemplateM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union(
        "PurposeTemplateAdded",
        "PurposeTemplateDraftUpdated",
        "PurposeTemplateAnnotationDocumentAdded",
        "PurposeTemplateAnnotationDocumentUpdated",
        "PurposeTemplateAnnotationDocumentDeleted",
        "PurposeTemplateDraftDeleted"
      ),
      () => m2mEventVisibility.owner
    )
    .with(
      P.union(
        "PurposeTemplatePublished",
        "PurposeTemplateSuspended",
        "PurposeTemplateUnsuspended",
        "PurposeTemplateArchived",
        "RiskAnalysisTemplateSignedDocumentGenerated"
      ),
      () => m2mEventVisibility.public
    )
    .with(
      P.union(
        "PurposeTemplateEServiceLinked",
        "PurposeTemplateEServiceUnlinked"
      ),
      () =>
        purposeTemplate.state === purposeTemplateState.published
          ? m2mEventVisibility.public
          : m2mEventVisibility.owner
    )
    .exhaustive();
}