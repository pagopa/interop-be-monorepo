import { z } from "zod";
import {
  DelegationId,
  PurposeId,
  PurposeM2MEventId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";
import { PurposeEventV2 } from "../purpose/purposeEvents.js";
import {
  M2MEventVisibility,
  m2mEventVisibility,
} from "./m2mEventVisibility.js";

export const PurposeM2MEventType = z.enum([
  "NewPurposeVersionWaitingForApproval",
  "PurposeWaitingForApproval",
  "PurposeVersionRejected",
  "PurposeVersionActivated",
  "DraftPurposeDeleted",
  "WaitingForApprovalPurposeDeleted",
  "PurposeAdded",
  "DraftPurposeUpdated",
  "PurposeActivated",
  "PurposeArchived",
  "PurposeVersionOverQuotaUnsuspended",
  "PurposeVersionSuspendedByConsumer",
  "PurposeVersionSuspendedByProducer",
  "PurposeVersionUnsuspendedByConsumer",
  "PurposeVersionUnsuspendedByProducer",
  "WaitingForApprovalPurposeVersionDeleted",
  "NewPurposeVersionActivated",
  "PurposeCloned",
  "PurposeDeletedByRevokedDelegation",
  "PurposeVersionArchivedByRevokedDelegation",
  "RiskAnalysisSignedDocumentGenerated",
]);
export type PurposeM2MEventType = z.infer<typeof PurposeM2MEventType>;

const _: PurposeEventV2["type"] = {} as PurposeM2MEventType;
// ^ Type check: ensure PurposeM2MEventType options are a subset of PurposeEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const PurposeM2MEvent = z.object({
  id: PurposeM2MEventId,
  eventType: PurposeM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  purposeId: PurposeId,
  purposeVersionId: PurposeVersionId.optional(),
  consumerId: TenantId,
  producerId: TenantId,
  consumerDelegateId: TenantId.optional(),
  consumerDelegationId: DelegationId.optional(),
  producerDelegateId: TenantId.optional(),
  producerDelegationId: DelegationId.optional(),
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.restricted,
    // No Purpose M2M events with Public visibility
  ]),
});

export type PurposeM2MEvent = z.infer<typeof PurposeM2MEvent>;
