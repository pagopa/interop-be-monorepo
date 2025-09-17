import {
  Delegation,
  EServiceEventEnvelopeV2,
  EServiceM2MEvent,
  EServiceV2,
  M2MEventVisibility,
  dateToString,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { EServiceM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { match } from "ts-pattern";
import { generateM2MEventId } from "../utils/uuidv7.js";

type EServiceVisibilityData =
  | {
      visibility: Extract<M2MEventVisibility, "Public">;
    }
  | {
      visibility: Extract<M2MEventVisibility, "Restricted">;
      producerDelegation: Delegation | undefined;
    };

export function toNewEServiceM2MEventSQL(
  eservice: EServiceV2,
  eventType: Extract<EServiceEventEnvelopeV2["type"], "DraftEServiceUpdated">,
  eventTimestamp: Date,
  visibility: EServiceVisibilityData
): EServiceM2MEventSQL {
  return toNewEServiceM2MEventSQLHelper(
    eservice,
    null,
    eventType,
    eventTimestamp,
    visibility
  );
}

export function toNewEServiceDescriptorM2MEventSQL(
  eservice: EServiceV2,
  descriptorId: string,
  eventType: Extract<
    EServiceEventEnvelopeV2["type"],
    "EServiceDescriptorPublished"
  >,
  eventTimestamp: Date,
  visibility: EServiceVisibilityData
): EServiceM2MEventSQL {
  return toNewEServiceM2MEventSQLHelper(
    eservice,
    descriptorId,
    eventType,
    eventTimestamp,
    visibility
  );
}

function toNewEServiceM2MEventSQLHelper(
  eservice: EServiceV2,
  descriptorId: string | null,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  visibility: EServiceVisibilityData
): EServiceM2MEventSQL {
  const visibilityFields = match(visibility)
    .with({ visibility: m2mEventVisibility.public }, () => ({
      visibility: m2mEventVisibility.public,
      producerId: null,
      producerDelegateId: null,
      producerDelegationId: null,
    }))
    .with(
      {
        visibility: m2mEventVisibility.restricted,
      },
      (v) => ({
        visibility: m2mEventVisibility.restricted,
        producerId: eservice.producerId,
        producerDelegationId: v.producerDelegation?.id ?? null,
        producerDelegateId: v.producerDelegation?.delegateId ?? null,
      })
    )
    .exhaustive();

  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: dateToString(eventTimestamp),
    eserviceId: eservice.id,
    descriptorId,
    ...visibilityFields,
  };
}
