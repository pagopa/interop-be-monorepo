/* eslint-disable max-params */
import {
  EService,
  Purpose,
  PurposeM2MEvent,
  PurposeVersionId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { generateM2MEventId } from "../../utils/uuidv7.js";
import { Delegations } from "../../models/delegations.js";

export function createPurposeM2MEvent(
  purpose: Purpose,
  eservice: EService,
  resourceVersion: number,
  eventType: PurposeM2MEvent["eventType"],
  eventTimestamp: Date,
  delegations: Delegations
): PurposeM2MEvent {
  return createPurposeM2MEventHelper(
    purpose,
    undefined,
    eservice,
    resourceVersion,
    eventType,
    eventTimestamp,
    delegations
  );
}

export function createPurposeVersionM2MEvent(
  purpose: Purpose,
  purposeVersionId: PurposeVersionId,
  eservice: EService,
  resourceVersion: number,
  eventType: PurposeM2MEvent["eventType"],
  eventTimestamp: Date,
  delegations: Delegations
): PurposeM2MEvent {
  return createPurposeM2MEventHelper(
    purpose,
    purposeVersionId,
    eservice,
    resourceVersion,
    eventType,
    eventTimestamp,
    delegations
  );
}

/**
 * Helper function to create a new PurposeM2MEvent.
 * Do not export this function directly; use the specific functions above instead.
 */
function createPurposeM2MEventHelper(
  purpose: Purpose,
  purposeVersionId: PurposeVersionId | undefined,
  eservice: EService,
  resourceVersion: number,
  eventType: PurposeM2MEvent["eventType"],
  eventTimestamp: Date,
  delegations: Delegations
): PurposeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    purposeId: purpose.id,
    purposeVersionId,
    consumerId: purpose.consumerId,
    producerId: eservice.producerId,
    consumerDelegateId: delegations.consumerDelegation?.delegateId,
    consumerDelegationId: delegations.consumerDelegation?.id,
    producerDelegateId: delegations.producerDelegation?.delegateId,
    producerDelegationId: delegations.producerDelegation?.id,
    visibility: getPurposeM2MEventVisibility(eventType),
  };
}

/**
 * Helper function to determine the visibility of an PurposeM2MEvent,
 * based on the event type; fallback to the state of the E-Service and its Descriptors if needed.
 */
function getPurposeM2MEventVisibility(
  eventType: PurposeM2MEvent["eventType"]
): PurposeM2MEvent["visibility"] {
  return match(eventType)
    .with(
      P.union(
        // Draft Purpose events, visible only to the owner (consumer or delegate)
        "PurposeAdded",
        "DraftPurposeUpdated",
        "DraftPurposeDeleted",
        "PurposeCloned",
        "PurposeDeletedByRevokedDelegation"
      ),
      () => m2mEventVisibility.owner
    )
    .with(
      P.union(
        // Purpose events after submission, visibility restricted to producer/consumer/delegates
        "PurposeActivated",
        "PurposeArchived",
        "PurposeVersionOverQuotaUnsuspended",
        "PurposeVersionSuspendedByConsumer",
        "PurposeVersionSuspendedByProducer",
        "PurposeVersionUnsuspendedByConsumer",
        "PurposeVersionUnsuspendedByProducer",
        "PurposeVersionActivated",
        "NewPurposeVersionActivated",
        "WaitingForApprovalPurposeVersionDeleted",
        "WaitingForApprovalPurposeDeleted",
        "PurposeWaitingForApproval",
        "NewPurposeVersionWaitingForApproval",
        "PurposeVersionRejected",
        "RiskAnalysisDocumentGenerated",
        "RiskAnalysisSignedDocumentGenerated",
        "PurposeVersionArchivedByRevokedDelegation"
      ),
      () => m2mEventVisibility.restricted
    )
    .exhaustive();
}
