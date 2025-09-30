import {
  Delegation,
  DescriptorId,
  EService,
  EServiceM2MEvent,
  M2MEventVisibility,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { generateM2MEventId } from "../utils/uuidv7.js";

export async function createEServiceM2MEvent(
  eservice: EService,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    undefined,
    eventType,
    eventTimestamp,
    producerDelegation,
    m2mEventVisibility.public // TODO compute from event or fallback on EService state
  );
}

export async function createEServiceDescriptorM2MEvent(
  eservice: EService,
  descriptorId: DescriptorId,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined
): Promise<EServiceM2MEvent> {
  return createEServiceM2MEventHelper(
    eservice,
    descriptorId,
    eventType,
    eventTimestamp,
    producerDelegation,
    m2mEventVisibility.public // TODO compute from event or fallback on Descriptor state
  );
}

// const restrictedVisibilityStates: DescriptorState[] = [
//   descriptorState.draft,
//   descriptorState.waitingForApproval,
// ];

// type DataForVisibility =
//   | {
//       visibility: Extract<M2MEventVisibility, "Public">;
//     }
//   | {
//       visibility: Extract<M2MEventVisibility, "Restricted">;
//       producerDelegation: Delegation | undefined;
//     };

// async function getEServiceDataForVisibility(
//   eservice: EService,
//   readModelService: ReadModelServiceSQL
// ): Promise<DataForVisibility> {
//   if (
//     eservice.descriptors.every((d) =>
//       restrictedVisibilityStates.includes(d.state)
//     )
//   ) {
//     return {
//       visibility: m2mEventVisibility.restricted,
//       producerDelegation:
//         await readModelService.getActiveProducerDelegationForEService(eservice),
//     };
//   } else {
//     return { visibility: m2mEventVisibility.public };
//   }
// }

// const retrieveDescriptorFromEService = (
//   descriptorId: DescriptorId,
//   eservice: EService
// ): Descriptor => {
//   const descriptor = eservice.descriptors.find(
//     (d: Descriptor) => d.id === descriptorId
//   );

//   if (descriptor === undefined) {
//     throw descriptorNotFoundInEService(descriptorId, eservice.id);
//   }

//   return descriptor;
// };

// async function getEServiceDescriptorDataForVisibility(
//   descriptorId: DescriptorId,
//   eservice: EService,
//   readModelService: ReadModelServiceSQL
// ): Promise<DataForVisibility> {
//   const descriptor = retrieveDescriptorFromEService(descriptorId, eservice);

//   if (restrictedVisibilityStates.includes(descriptor.state)) {
//     return {
//       visibility: m2mEventVisibility.restricted,
//       producerDelegation:
//         await readModelService.getActiveProducerDelegationForEService(eservice),
//     };
//   } else {
//     return { visibility: m2mEventVisibility.public };
//   }
// }

/**
 * Helper function to create a new EServiceM2MEvent with the correct visibility fields.
 * Do not export this function directly; use the specific functions above instead.
 */
// eslint-disable-next-line max-params
function createEServiceM2MEventHelper(
  eservice: EService,
  descriptorId: DescriptorId | undefined,
  eventType: EServiceM2MEvent["eventType"],
  eventTimestamp: Date,
  producerDelegation: Delegation | undefined,
  visibility: M2MEventVisibility
): EServiceM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    eserviceId: eservice.id,
    descriptorId,
    producerId: eservice.producerId,
    producerDelegateId: producerDelegation?.delegateId,
    producerDelegationId: producerDelegation?.id,
    visibility,
  };
}
