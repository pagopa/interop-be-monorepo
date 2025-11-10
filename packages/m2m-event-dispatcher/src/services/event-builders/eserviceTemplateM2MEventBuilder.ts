/* eslint-disable max-params */
import {
  EServiceTemplate,
  EServiceTemplateM2MEvent,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  eserviceTemplateVersionState,
  EServiceTemplateVersionState,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";
import { eserviceTemplateVersionNotFoundInEServiceTemplate } from "../../models/errors.js";

export async function createEServiceTemplateM2MEvent(
  eserviceTemplate: EServiceTemplate,
  resourceVersion: number,
  eventType: EServiceTemplateM2MEvent["eventType"],
  eventTimestamp: Date
): Promise<EServiceTemplateM2MEvent> {
  return createEServiceTemplateM2MEventHelper(
    eserviceTemplate,
    undefined,
    resourceVersion,
    eventType,
    eventTimestamp
  );
}

export async function createEServiceTemplateVersionM2MEvent(
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  resourceVersion: number,
  eventType: EServiceTemplateM2MEvent["eventType"],
  eventTimestamp: Date
): Promise<EServiceTemplateM2MEvent> {
  return createEServiceTemplateM2MEventHelper(
    eserviceTemplate,
    eserviceTemplateVersionId,
    resourceVersion,
    eventType,
    eventTimestamp
  );
}

/**
 * Helper function to create a new EServiceTemplateM2MEvent.
 * Do not export this function directly; use the specific functions above instead.
 */
function createEServiceTemplateM2MEventHelper(
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId | undefined,
  resourceVersion: number,
  eventType: EServiceTemplateM2MEvent["eventType"],
  eventTimestamp: Date
): EServiceTemplateM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    eserviceTemplateId: eserviceTemplate.id,
    eserviceTemplateVersionId,
    creatorId: eserviceTemplate.creatorId,
    visibility: getEServiceTemplateM2MEventVisibility(
      eventType,
      eserviceTemplate,
      eserviceTemplateVersionId
    ),
  };
}

/**
 * Helper function to determine the visibility of an EServiceM2MEvent,
 * based on the event type; fallback to the state of the E-Service and its Descriptors if needed.
 */
function getEServiceTemplateM2MEventVisibility(
  eventType: EServiceTemplateM2MEvent["eventType"],
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId | undefined
): EServiceTemplateM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union(
        // Draft E-Service Template events, visible only to the owner (producer or delegate)
        "EServiceTemplateAdded",
        "EServiceTemplateDraftUpdated",
        "EServiceTemplateVersionAdded",
        "EServiceTemplateDeleted",
        "EServiceTemplateRiskAnalysisAdded",
        "EServiceTemplateRiskAnalysisUpdated",
        "EServiceTemplateRiskAnalysisDeleted",
        "EServiceTemplateDraftVersionDeleted",
        "EServiceTemplateDraftVersionUpdated",
        "EServiceTemplateDraftVersionDeleted",
        "EServiceTemplateVersionInterfaceAdded",
        "EServiceTemplateVersionInterfaceDeleted",
        "EServiceTemplateVersionInterfaceUpdated"
      ),
      () => m2mEventVisibility.owner
    )
    .with(
      P.union(
        // E-Service Template events after publication, visible to everyone (public)
        "EServiceTemplateVersionActivated",
        "EServiceTemplateVersionSuspended",
        "EServiceTemplateIntendedTargetUpdated",
        "EServiceTemplateDescriptionUpdated",
        "EServiceTemplateNameUpdated",
        "EServiceTemplateVersionAttributesUpdated",
        "EServiceTemplateVersionPublished",
        "EServiceTemplateVersionQuotasUpdated",
        "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
      ),
      () => m2mEventVisibility.public
    )
    .with(
      P.union(
        // Events that apply both to draft and published E-Service Templates,
        // visibility depends on the state of the E-Service Template Versions
        "EServiceTemplateVersionDocumentAdded",
        "EServiceTemplateVersionDocumentDeleted",
        "EServiceTemplateVersionDocumentUpdated"
      ),
      () =>
        getEServiceTemplateM2MEventVisibilityFromEServiceTemplate(
          eserviceTemplate,
          eserviceTemplateVersionId
        )
    )
    .exhaustive();
}

const ownerVisibilityStates: EServiceTemplateVersionState[] = [
  eserviceTemplateVersionState.draft,
];

function getEServiceTemplateM2MEventVisibilityFromEServiceTemplate(
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId | undefined
): EServiceTemplateM2MEvent["visibility"] {
  const version = eserviceTemplateVersionId
    ? retrieveEServiceTemplateVersionFromEServiceTemplate(
        eserviceTemplate,
        eserviceTemplateVersionId
      )
    : undefined;
  if (
    (version !== undefined && ownerVisibilityStates.includes(version.state)) ||
    eserviceTemplate.versions.every((d) =>
      ownerVisibilityStates.includes(d.state)
    )
  ) {
    return m2mEventVisibility.owner;
  } else {
    return m2mEventVisibility.public;
  }
}

const retrieveEServiceTemplateVersionFromEServiceTemplate = (
  eserviceTemplate: EServiceTemplate,
  eserviceTemplateVersionId: EServiceTemplateVersionId
): EServiceTemplateVersion => {
  const version = eserviceTemplate.versions.find(
    (d: EServiceTemplateVersion) => d.id === eserviceTemplateVersionId
  );

  if (version === undefined) {
    throw eserviceTemplateVersionNotFoundInEServiceTemplate(
      eserviceTemplateVersionId,
      eserviceTemplate.id
    );
  }

  return version;
};
