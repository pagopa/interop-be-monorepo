import { z } from "zod";
import {
  EServiceM2MEventId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  TenantId,
} from "../brandedIds.js";
import { EServiceTemplateEventV2 } from "../eservice-template/eserviceTemplateEvents.js";
import {
  M2MEventVisibility,
  m2mEventVisibility,
} from "./m2mEventVisibility.js";

export const EServiceTemplateM2MEventType = z.enum([
  "EServiceTemplateVersionActivated",
  "EServiceTemplateAdded",
  "EServiceTemplateIntendedTargetUpdated",
  "EServiceTemplateDescriptionUpdated",
  "EServiceTemplateDeleted",
  "EServiceTemplateDraftVersionDeleted",
  "EServiceTemplateDraftVersionUpdated",
  "EServiceTemplateDraftUpdated",
  "EServiceTemplateNameUpdated",
  "EServiceTemplateRiskAnalysisAdded",
  "EServiceTemplateRiskAnalysisDeleted",
  "EServiceTemplateRiskAnalysisUpdated",
  "EServiceTemplateVersionSuspended",
  "EServiceTemplateVersionAdded",
  "EServiceTemplateVersionAttributesUpdated",
  "EServiceTemplateVersionDocumentAdded",
  "EServiceTemplateVersionDocumentDeleted",
  "EServiceTemplateVersionDocumentUpdated",
  "EServiceTemplateVersionInterfaceAdded",
  "EServiceTemplateVersionInterfaceDeleted",
  "EServiceTemplateVersionInterfaceUpdated",
  "EServiceTemplateVersionPublished",
  "EServiceTemplateVersionQuotasUpdated",
  "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
]);
export type EServiceTemplateM2MEventType = z.infer<
  typeof EServiceTemplateM2MEventType
>;

const _: EServiceTemplateEventV2["type"] = {} as EServiceTemplateM2MEventType;
// ^ Type check: ensure EServiceTemplateM2MEventType options are a subset of EServiceEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const EServiceTemplateM2MEvent = z.object({
  id: EServiceM2MEventId,
  eventType: EServiceTemplateM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId.optional(),
  creatorId: TenantId,
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.public,
    // No E-Service Template M2M events with Restricted visibility
  ]),
});

export type EServiceTemplateM2MEvent = z.infer<typeof EServiceTemplateM2MEvent>;
