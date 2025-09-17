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

type EServiceM2MEventVisibilityData =
  | {
      visibility: Extract<M2MEventVisibility, "Public">;
    }
  | {
      visibility: Extract<M2MEventVisibility, "Restricted">;
      producerDelegation: Delegation | undefined;
    };

export function toNewEServiceM2MEventSQL(
  event: Extract<EServiceEventEnvelopeV2, { type: "DraftEServiceUpdated" }> & {
    data: { eservice: EServiceV2 };
  },
  eventTimestamp: Date,
  visibility: EServiceM2MEventVisibilityData
): EServiceM2MEventSQL {
  return toNewEServiceM2MEventSQLHelper(
    event.data.eservice,
    null,
    event.type,
    eventTimestamp,
    visibility
  );
}

export function toNewEServiceDescriptorM2MEventSQL(
  event: Extract<
    EServiceEventEnvelopeV2,
    { type: "EServiceDescriptorPublished" }
  > & { data: { eservice: EServiceV2; descriptorId: string } },
  eventTimestamp: Date,
  visibility: EServiceM2MEventVisibilityData
): EServiceM2MEventSQL {
  return toNewEServiceM2MEventSQLHelper(
    event.data.eservice,
    event.data.descriptorId,
    event.type,
    eventTimestamp,
    visibility
  );
}

function toNewEServiceM2MEventSQLHelper(
  eservice: EServiceV2,
  descriptorId: string | null,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  visibility: EServiceM2MEventVisibilityData
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
