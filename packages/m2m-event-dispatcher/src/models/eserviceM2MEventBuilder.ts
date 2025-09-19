import {
  Delegation,
  DescriptorId,
  EService,
  EServiceM2MEvent,
  M2MEventVisibility,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { generateM2MEventId } from "../utils/uuidv7.js";

type DataForVisibilityComputation =
  | {
      visibility: Extract<M2MEventVisibility, "Public">;
    }
  | {
      visibility: Extract<M2MEventVisibility, "Restricted">;
      producerDelegation: Delegation | undefined;
    };

export function createEServiceM2MEvent(
  eservice: EService,
  eventType: Extract<EServiceM2MEvent["eventType"], "DraftEServiceUpdated">,
  eventTimestamp: Date,
  visibility: DataForVisibilityComputation
): EServiceM2MEvent {
  return createEServiceM2MEventHelper(
    eservice,
    undefined,
    eventType,
    eventTimestamp,
    visibility
  );
}

export function createEServiceDescriptorM2MEvent(
  eservice: EService,
  descriptorId: DescriptorId,
  eventType: Extract<
    EServiceM2MEvent["eventType"],
    "EServiceDescriptorPublished"
  >,
  eventTimestamp: Date,
  visibility: DataForVisibilityComputation
): EServiceM2MEvent {
  return createEServiceM2MEventHelper(
    eservice,
    descriptorId,
    eventType,
    eventTimestamp,
    visibility
  );
}

/**
 * Helper function to create a new EServiceM2MEvent with the correct visibility fields.
 * Do not export this function directly; use the specific functions above instead.
 */
function createEServiceM2MEventHelper(
  eservice: EService,
  descriptorId: DescriptorId | undefined,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  visibility: DataForVisibilityComputation
): EServiceM2MEvent {
  const visibilityFields = match(visibility)
    .with({ visibility: m2mEventVisibility.public }, () => ({
      visibility: m2mEventVisibility.public,
      producerId: undefined,
      producerDelegateId: undefined,
      producerDelegationId: undefined,
    }))
    .with(
      {
        visibility: m2mEventVisibility.restricted,
      },
      (v) => ({
        visibility: m2mEventVisibility.restricted,
        producerId: eservice.producerId,
        producerDelegationId: v.producerDelegation?.id ?? undefined,
        producerDelegateId: v.producerDelegation?.delegateId ?? undefined,
      })
    )
    .exhaustive();

  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    eserviceId: eservice.id,
    descriptorId,
    ...visibilityFields,
  };
}
