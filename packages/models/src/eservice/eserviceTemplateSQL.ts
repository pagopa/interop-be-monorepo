import { z } from "zod";
import { AttributeKind } from "../attribute/attribute.js";
import { AttributeId, EServiceDocumentId, TenantId } from "../brandedIds.js";
import {
  AgreementApprovalPolicy,
  DocumentKind,
  EServiceMode,
  Technology,
} from "./eservice.js";

export const EServiceTemplateId = z.string().uuid().brand("EServiceTemplateId");
export type EServiceTemplateId = z.infer<typeof EServiceTemplateId>;

// TODO: remove and import from brandedIds
export const EServiceTemplateVersionId = z
  .string()
  .uuid()
  .brand("EServiceTemplateVersionId");
export type EServiceTemplateVersionId = z.infer<
  typeof EServiceTemplateVersionId
>;

// TODO: remove and import from brandedIds
export const eserviceTemplateVersionState = {
  draft: "Draft",
  published: "Published",
  suspended: "Suspended",
  deprecated: "Deprecated",
} as const;
export const EServiceTemplateVersionState = z.enum([
  Object.values(eserviceTemplateVersionState)[0],
  ...Object.values(eserviceTemplateVersionState).slice(1),
]);
export type EServiceTemplateVersionState = z.infer<
  typeof EServiceTemplateVersionState
>;

export const EServiceTemplateVersionSQL = z.object({
  id: EServiceTemplateVersionId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  version: z.string(),
  description: z.string().optional(),
  state: EServiceTemplateVersionState,
  voucher_lifespan: z.number().int(),
  daily_calls_per_consumer: z.number().int().optional(),
  daily_calls_total: z.number().int().optional(),
  agreement_approval_policy: AgreementApprovalPolicy.optional(),
  created_at: z.coerce.date(),
  published_at: z.coerce.date().optional().nullable(),
  suspended_at: z.coerce.date().optional().nullable(),
  deprecated_at: z.coerce.date().optional().nullable(),
});
export type EServiceTemplateVersionSQL = z.infer<
  typeof EServiceTemplateVersionSQL
>;

export const EServiceTemplateVersionDocumentSQL = z.object({
  id: EServiceDocumentId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  eservice_template_version_id: EServiceTemplateVersionId,
  name: z.string(),
  content_type: z.string(),
  pretty_name: z.string(),
  path: z.string(),
  checksum: z.string(),
  upload_date: z.coerce.date(),
  kind: DocumentKind,
});
export type EServiceTemplateVersionDocumentSQL = z.infer<
  typeof EServiceTemplateVersionDocumentSQL
>;

export const EServiceTemplateVersionAttributeSQL = z.object({
  attribute_id: AttributeId,
  eservice_template_id: EServiceTemplateId,
  metadata_version: z.number(),
  eservice_template_version_id: EServiceTemplateVersionId,
  explicit_attribute_verification: z.boolean(),
  kind: AttributeKind,
  group_id: z.number(),
});
export type EServiceTemplateVersionAttributeSQL = z.infer<
  typeof EServiceTemplateVersionAttributeSQL
>;

export const EServiceTemplateSQL = z.object({
  id: EServiceTemplateId,
  metadata_version: z.number(),
  creator_id: TenantId,
  name: z.string(),
  audience_description: z.string(),
  eservice_description: z.string(),
  technology: Technology,
  created_at: z.coerce.date(),
  mode: EServiceMode,
  is_signal_hub_enabled: z.boolean().optional(),
});
export type EServiceTemplateSQL = z.infer<typeof EServiceTemplateSQL>;
