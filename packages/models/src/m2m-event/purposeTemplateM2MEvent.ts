import { z } from "zod";
import {
  PurposeTemplateId,
  PurposeTemplateM2MEventId,
  TenantId,
} from "../brandedIds.js";
import { PurposeTemplateEventV2 } from "../purpose-template/purposeTemplateEvents.js";
import {
  M2MEventVisibility,
  m2mEventVisibility,
} from "./m2mEventVisibility.js";

export const PurposeTemplateM2MEventType = z.enum([
  "PurposeTemplateAdded",
  "PurposeTemplateEServiceLinked",
  "PurposeTemplateEServiceUnlinked",
  "PurposeTemplateAnnotationDocumentAdded",
  "PurposeTemplateAnnotationDocumentUpdated",
  "PurposeTemplateAnnotationDocumentDeleted",
  "PurposeTemplateDraftUpdated",
  "PurposeTemplatePublished",
  "PurposeTemplateSuspended",
  "PurposeTemplateUnsuspended",
  "PurposeTemplateArchived",
  "PurposeTemplateDraftDeleted",
  "RiskAnalysisTemplateSignedDocumentGenerated",
]);
export type PurposeTemplateM2MEventType = z.infer<
  typeof PurposeTemplateM2MEventType
>;

const _: PurposeTemplateEventV2["type"] = {} as PurposeTemplateM2MEventType;
// ^ Type check: ensure PurposeTemplateM2MEventType options are a subset of PurposeTemplateEventV2["type"].
//   This is required because Zod does not have an equivalent of TS Extract<...>.

void _; // avoid unused variable TS error, cannot use ts-ignore for a type check

export const PurposeTemplateM2MEvent = z.object({
  id: PurposeTemplateM2MEventId,
  eventType: PurposeTemplateM2MEventType,
  eventTimestamp: z.coerce.date(),
  resourceVersion: z.number().int().min(0),
  purposeTemplateId: PurposeTemplateId,
  creatorId: TenantId,
  visibility: M2MEventVisibility.extract([
    m2mEventVisibility.owner,
    m2mEventVisibility.public,
  ]),
});

export type PurposeTemplateM2MEvent = z.infer<typeof PurposeTemplateM2MEvent>;
