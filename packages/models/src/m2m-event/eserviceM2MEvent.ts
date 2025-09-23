import { z } from "zod";
import { EServiceEventV2 } from "../eservice/eserviceEvents.js";
import {
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceM2MEventId,
  TenantId,
} from "../brandedIds.js";
import { m2mEventVisibility } from "./m2mEventVisibility.js";

export const EServiceM2MEventType = z.enum([
  "EServiceAdded",
  "DraftEServiceUpdated",
  "EServiceCloned",
  "EServiceDeleted",
  "EServiceNameUpdated",
  "EServiceDescriptionUpdated",
  "EServiceIsConsumerDelegableEnabled",
  "EServiceIsConsumerDelegableDisabled",
  "EServiceIsClientAccessDelegableEnabled",
  "EServiceIsClientAccessDelegableDisabled",
  "EServiceNameUpdatedByTemplateUpdate",
  "EServiceDescriptionUpdatedByTemplateUpdate",
  "EServiceSignalHubEnabled",
  "EServiceSignalHubDisabled",
  "EServiceDescriptorPublished",
  "EServiceDescriptorActivated",
  "EServiceDescriptorApprovedByDelegator",
  "EServiceDescriptorSuspended",
  "EServiceDescriptorArchived",
  "EServiceDescriptorQuotasUpdated",
  "EServiceDescriptorAgreementApprovalPolicyUpdated",
  "EServiceDescriptorAdded",
  "EServiceDraftDescriptorDeleted",
  "EServiceDraftDescriptorUpdated",
  "EServiceDescriptorAttributesUpdated",
  "EServiceDescriptorSubmittedByDelegate",
  "EServiceDescriptorRejectedByDelegator",
  "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
  "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
  // TODO risk analysis events and sub resource riskAnalysisId?
  // TODO document events and sub resource documentId?
]);
export type EServiceM2MEventType = z.infer<typeof EServiceM2MEventType>;

const _: EServiceEventV2["type"] = {} as EServiceM2MEventType;
// ^ Type check: ensure EServiceM2MEventType options are a subset of EServiceEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

const EServiceM2MEventFields = z.object({
  id: EServiceM2MEventId,
  eventType: EServiceM2MEventType,
  eventTimestamp: z.coerce.date(),
  eserviceId: EServiceId,
  descriptorId: DescriptorId.optional(),
});

const EServiceM2MEventPublic = EServiceM2MEventFields.extend({
  visibility: z.literal(m2mEventVisibility.public),
});

const EServiceM2MEventRestricted = EServiceM2MEventFields.extend({
  visibility: z.literal(m2mEventVisibility.restricted),
  producerId: TenantId,
  producerDelegateId: TenantId.optional(),
  producerDelegationId: DelegationId.optional(),
});

export const EServiceM2MEvent = z.discriminatedUnion("visibility", [
  EServiceM2MEventPublic,
  EServiceM2MEventRestricted,
]);

export type EServiceM2MEvent = z.infer<typeof EServiceM2MEvent>;
