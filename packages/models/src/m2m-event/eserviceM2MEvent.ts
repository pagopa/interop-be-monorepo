import { z } from "zod";
import { EServiceEventV2 } from "../eservice/eserviceEvents.js";
import {
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceM2MEventId,
  TenantId,
} from "../brandedIds.js";
import {
  M2MEventVisibility,
  m2mEventVisibility,
} from "./m2mEventVisibility.js";

export const EServiceM2MEventType = z.enum([
  // EService events
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
  "EServiceRiskAnalysisAdded",
  "EServiceRiskAnalysisUpdated",
  "EServiceRiskAnalysisDeleted",
  "EServicePersonalDataFlagUpdatedAfterPublication",
  "EServicePersonalDataFlagUpdatedByTemplateUpdate",

  // EService Descriptor events
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
  "EServiceDescriptorDocumentAdded",
  "EServiceDescriptorDocumentUpdated",
  "EServiceDescriptorDocumentDeleted",
  "EServiceDescriptorDocumentAddedByTemplateUpdate",
  "EServiceDescriptorDocumentDeletedByTemplateUpdate",
  "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
  "EServiceDescriptorInterfaceAdded",
  "EServiceDescriptorInterfaceUpdated",
  "EServiceDescriptorInterfaceDeleted",
]);
export type EServiceM2MEventType = z.infer<typeof EServiceM2MEventType>;

const _: EServiceEventV2["type"] = {} as EServiceM2MEventType;
// ^ Type check: ensure EServiceM2MEventType options are a subset of EServiceEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const EServiceM2MEvent = z.object({
  id: EServiceM2MEventId,
  eventType: EServiceM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  eserviceId: EServiceId,
  descriptorId: DescriptorId.optional(),
  producerId: TenantId,
  producerDelegateId: TenantId.optional(),
  producerDelegationId: DelegationId.optional(),
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.public,
    // No E-Service M2M events with Restricted visibility
  ]),
});

export type EServiceM2MEvent = z.infer<typeof EServiceM2MEvent>;
