import { z } from "zod";
import { AgreementEventV2 } from "../agreement/agreementEvents.js";
import {
  DelegationId,
  AgreementId,
  AgreementM2MEventId,
  TenantId,
} from "../brandedIds.js";
import {
  M2MEventVisibility,
  m2mEventVisibility,
} from "./m2mEventVisibility.js";

export const AgreementM2MEventType = z.enum([
  "AgreementAdded",
  "AgreementDeleted",
  "DraftAgreementUpdated",
  "AgreementSubmitted",
  "AgreementActivated",
  "AgreementUnsuspendedByProducer",
  "AgreementUnsuspendedByConsumer",
  "AgreementUnsuspendedByPlatform",
  "AgreementArchivedByConsumer",
  "AgreementArchivedByUpgrade",
  "AgreementUpgraded",
  "AgreementSuspendedByProducer",
  "AgreementSuspendedByConsumer",
  "AgreementSuspendedByPlatform",
  "AgreementRejected",
  "AgreementConsumerDocumentAdded",
  "AgreementConsumerDocumentRemoved",
  "AgreementSetDraftByPlatform",
  "AgreementSetMissingCertifiedAttributesByPlatform",
  "AgreementDeletedByRevokedDelegation",
  "AgreementArchivedByRevokedDelegation",
  "AgreementContractGenerated",
  "AgreementSignedContractGenerated",
]);
export type AgreementM2MEventType = z.infer<typeof AgreementM2MEventType>;

const _: AgreementEventV2["type"] = {} as AgreementM2MEventType;
// ^ Type check: ensure AgreementM2MEventType options are a subset of AgreementEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const AgreementM2MEvent = z.object({
  id: AgreementM2MEventId,
  eventType: AgreementM2MEventType,
  eventTimestamp: z.coerce.date(),
  agreementId: AgreementId,
  consumerId: TenantId,
  producerId: TenantId,
  consumerDelegateId: TenantId.optional(),
  consumerDelegationId: DelegationId.optional(),
  producerDelegateId: TenantId.optional(),
  producerDelegationId: DelegationId.optional(),
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.restricted,
    // No E-Service M2M events with Public visibility
  ]),
});

export type AgreementM2MEvent = z.infer<typeof AgreementM2MEvent>;
