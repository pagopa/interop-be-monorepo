import z from "zod";
import { AttributeKind } from "../attribute/attribute.js";
import {
  AgreementDocumentId,
  AgreementId,
  AttributeId,
  DelegationId,
  DescriptorId,
  EServiceId,
  TenantId,
  UserId,
} from "./../brandedIds.js";

export const agreementState = {
  draft: "Draft",
  suspended: "Suspended",
  archived: "Archived",
  pending: "Pending",
  active: "Active",
  missingCertifiedAttributes: "MissingCertifiedAttributes",
  rejected: "Rejected",
} as const;
export const AgreementState = z.enum([
  Object.values(agreementState)[0],
  ...Object.values(agreementState).slice(1),
]);
export type AgreementState = z.infer<typeof AgreementState>;

export const agreementStampKind = {
  submission: "submission",
  activation: "activation",
  rejection: "rejection",
  suspensionByProducer: "suspensionByProducer",
  suspensionByConsumer: "suspensionByConsumer",
} as const;
export const AgreementStampKind = z.enum([
  Object.values(agreementStampKind)[0],
  ...Object.values(agreementStampKind).slice(1),
]);
export type AgreementStampKind = z.infer<typeof AgreementStampKind>;

export const agreementDocumentKind = {
  consumerDoc: "consumerDoc",
  contract: "contract",
} as const;
export const AgreementDocumentKind = z.enum([
  Object.values(agreementDocumentKind)[0],
  ...Object.values(agreementDocumentKind).slice(1),
]);
export type AgreementDocumentKind = z.infer<typeof AgreementDocumentKind>;

export const AgreementAttribute = z.object({ id: AttributeId });
export type AgreementAttribute = z.infer<typeof AgreementAttribute>;

export const AgreementAttributeSQL = z.object({
  agreement_id: AgreementId,
  metadata_version: z.number(),
  attribute_id: AttributeId,
  kind: AttributeKind,
});
export type AgreementAttributeSQL = z.infer<typeof AgreementAttributeSQL>;

export const AgreementDocument = z.object({
  id: AgreementDocumentId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});
export type AgreementDocument = z.infer<typeof AgreementDocument>;

export const AgreementDocumentSQL = z.object({
  id: AgreementDocumentId,
  agreement_id: AgreementId,
  metadata_version: z.number(),
  name: z.string(),
  pretty_name: z.string(),
  content_type: z.string(),
  path: z.string(),
  created_at: z.coerce.date(),
  kind: AgreementDocumentKind,
});
export type AgreementDocumentSQL = z.infer<typeof AgreementDocumentSQL>;

export const AgreementStamp = z.object({
  who: UserId,
  delegationId: DelegationId.optional(),
  when: z.coerce.date(),
});
export type AgreementStamp = z.infer<typeof AgreementStamp>;

export const AgreementStamps = z.object({
  submission: AgreementStamp.optional(),
  activation: AgreementStamp.optional(),
  rejection: AgreementStamp.optional(),
  suspensionByProducer: AgreementStamp.optional(),
  suspensionByConsumer: AgreementStamp.optional(),
  upgrade: AgreementStamp.optional(),
  archiving: AgreementStamp.optional(),
});
export type AgreementStamps = z.infer<typeof AgreementStamps>;

export const AgreementStampSQL = z.object({
  agreement_id: AgreementId,
  metadata_version: z.number(),
  who: UserId,
  delegation_id: DelegationId.optional(),
  when: z.coerce.date(),
  kind: AgreementStampKind,
});
export type AgreementStampSQL = z.infer<typeof AgreementStampSQL>;

export const Agreement = z.object({
  id: AgreementId,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  producerId: TenantId,
  consumerId: TenantId,
  state: AgreementState,
  verifiedAttributes: z.array(AgreementAttribute),
  certifiedAttributes: z.array(AgreementAttribute),
  declaredAttributes: z.array(AgreementAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  consumerDocuments: z.array(AgreementDocument),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  consumerNotes: z.string().optional(),
  contract: AgreementDocument.optional(),
  stamps: AgreementStamps,
  rejectionReason: z.string().optional(),
  suspendedAt: z.coerce.date().optional(),
});
export type Agreement = z.infer<typeof Agreement>;

export const AgreementSQL = z.object({
  id: AgreementId,
  metadata_version: z.number(),
  eservice_id: EServiceId,
  descriptor_id: DescriptorId,
  producer_id: TenantId,
  consumer_id: TenantId,
  state: AgreementState,
  suspended_by_consumer: z.boolean().optional(),
  suspended_by_producer: z.boolean().optional(),
  suspended_by_platform: z.boolean().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  consumer_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
  suspended_at: z.coerce.date().optional(),
});
export type AgreementSQL = z.infer<typeof AgreementSQL>;
