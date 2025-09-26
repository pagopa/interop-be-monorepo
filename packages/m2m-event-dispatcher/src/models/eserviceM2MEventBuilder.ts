import {
  Delegation,
  Descriptor,
  DescriptorId,
  DescriptorState,
  EService,
  EServiceM2MEvent,
  M2MEventVisibility,
  descriptorState,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { generateM2MEventId } from "../utils/uuidv7.js";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { descriptorNotFoundInEService } from "./errors.js";

export async function createEServiceM2MEvent(
  eservice: EService,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  readModelService: ReadModelServiceSQL
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    undefined,
    eventType,
    eventTimestamp,
    await getEServiceDataForVisibility(eservice, readModelService)
  );
}

export async function createEServiceDescriptorM2MEvent(
  eservice: EService,
  descriptorId: DescriptorId,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  readModelService: ReadModelServiceSQL
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    descriptorId,
    eventType,
    eventTimestamp,
    await getEServiceDescriptorDataForVisibility(
      descriptorId,
      eservice,
      readModelService
    )
  );
}

const restrictedVisibilityStates: DescriptorState[] = [
  descriptorState.draft,
  descriptorState.waitingForApproval,
];

type DataForVisibility =
  | {
      visibility: Extract<M2MEventVisibility, "Public">;
    }
  | {
      visibility: Extract<M2MEventVisibility, "Restricted">;
      producerDelegation: Delegation | undefined;
    };

async function getEServiceDataForVisibility(
  eservice: EService,
  readModelService: ReadModelServiceSQL
): Promise<DataForVisibility> {
  if (
    eservice.descriptors.every((d) =>
      restrictedVisibilityStates.includes(d.state)
    )
  ) {
    return {
      visibility: m2mEventVisibility.restricted,
      producerDelegation:
        await readModelService.getActiveProducerDelegationForEService(eservice),
    };
  } else {
    return { visibility: m2mEventVisibility.public };
  }
}

const retrieveDescriptorFromEService = (
  descriptorId: DescriptorId,
  eservice: EService
): Descriptor => {
  const descriptor = eservice.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw descriptorNotFoundInEService(descriptorId, eservice.id);
  }

  return descriptor;
};

async function getEServiceDescriptorDataForVisibility(
  descriptorId: DescriptorId,
  eservice: EService,
  readModelService: ReadModelServiceSQL
): Promise<DataForVisibility> {
  const descriptor = retrieveDescriptorFromEService(descriptorId, eservice);

  if (restrictedVisibilityStates.includes(descriptor.state)) {
    return {
      visibility: m2mEventVisibility.restricted,
      producerDelegation:
        await readModelService.getActiveProducerDelegationForEService(eservice),
    };
  } else {
    return { visibility: m2mEventVisibility.public };
  }
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
  visibility: DataForVisibility
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
