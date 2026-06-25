import z from "zod";
import {
  AttributeId,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  TenantId,
} from "../brandedIds.js";
import { RiskAnalysis } from "../risk-analysis/riskAnalysis.js";

export const technology = { rest: "Rest", soap: "Soap" } as const;
export const Technology = z.enum([
  Object.values(technology)[0],
  ...Object.values(technology).slice(1),
]);
export type Technology = z.infer<typeof Technology>;

export const descriptorState = {
  draft: "Draft",
  published: "Published",
  deprecated: "Deprecated",
  suspended: "Suspended",
  archived: "Archived",
  waitingForApproval: "WaitingForApproval",
  archiving: "Archiving",
  archivingSuspended: "ArchivingSuspended",
} as const;
export const DescriptorState = z.enum([
  Object.values(descriptorState)[0],
  ...Object.values(descriptorState).slice(1),
]);
export type DescriptorState = z.infer<typeof DescriptorState>;

export const agreementApprovalPolicy = {
  manual: "Manual",
  automatic: "Automatic",
} as const;
export const AgreementApprovalPolicy = z.enum([
  Object.values(agreementApprovalPolicy)[0],
  ...Object.values(agreementApprovalPolicy).slice(1),
]);
export type AgreementApprovalPolicy = z.infer<typeof AgreementApprovalPolicy>;

export const EServiceAttribute = z.object({
  id: AttributeId,
});
export type EServiceAttribute = z.infer<typeof EServiceAttribute>;

export const EServiceAttributeCertified = EServiceAttribute.extend({
  dailyCallsPerConsumer: z.number().int().min(1).max(1000000000).optional(),
});
export type EServiceAttributeCertified = z.infer<
  typeof EServiceAttributeCertified
>;

export const attributeCertifiedDiscreteComparator = {
  GT: "GT",
  LT: "LT",
  EQ: "EQ",
  GTE: "GTE",
  LTE: "LTE",
  NE: "NE",
} as const;
export const AttributeCertifiedDiscreteComparator = z.enum([
  Object.values(attributeCertifiedDiscreteComparator)[0],
  ...Object.values(attributeCertifiedDiscreteComparator).slice(1),
]);
export type AttributeCertifiedDiscreteComparator = z.infer<
  typeof AttributeCertifiedDiscreteComparator
>;

export const EServiceAttributeCertifiedDiscreteConfig = z.object({
  threshold: z.number().int().min(1).max(1000000000),
  comparator: AttributeCertifiedDiscreteComparator,
});
export type EServiceAttributeCertifiedDiscreteConfig = z.infer<
  typeof EServiceAttributeCertifiedDiscreteConfig
>;

export const EServiceAttributeCertifiedDiscrete =
  EServiceAttributeCertified.extend({
    discreteConfig: EServiceAttributeCertifiedDiscreteConfig,
  });
export type EServiceAttributeCertifiedDiscrete = z.infer<
  typeof EServiceAttributeCertifiedDiscrete
>;
export type EServiceCertifiedAttribute =
  | EServiceAttribute
  | EServiceAttributeCertified
  | EServiceAttributeCertifiedDiscrete;

export const getEServiceAttributeDiscreteConfig = (
  attribute: EServiceCertifiedAttribute
): EServiceAttributeCertifiedDiscreteConfig | undefined =>
  "discreteConfig" in attribute ? attribute.discreteConfig : undefined;

export const EServiceAttributes = z.object({
  certified: z.array(
    z.array(
      z.union([EServiceAttributeCertifiedDiscrete, EServiceAttributeCertified])
    )
  ),
  declared: z.array(z.array(EServiceAttribute)),
  verified: z.array(z.array(EServiceAttribute)),
});
export type EserviceAttributes = z.infer<typeof EServiceAttributes>;

export const Document = z.object({
  id: EServiceDocumentId,
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.coerce.date(),
});
export type Document = z.infer<typeof Document>;

export const DescriptorRejectionReason = z.object({
  rejectionReason: z.string(),
  rejectedAt: z.coerce.date(),
});
export type DescriptorRejectionReason = z.infer<
  typeof DescriptorRejectionReason
>;

export const TemplateInstanceInterfaceMetadata = z.object({
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactUrl: z.string().optional(),
  termsAndConditionsUrl: z.string().optional(),
});

export type TemplateInstanceInterfaceMetadata = z.infer<
  typeof TemplateInstanceInterfaceMetadata
>;

export const EServiceTemplateVersionRef = z.object({
  id: EServiceTemplateVersionId,
  interfaceMetadata: TemplateInstanceInterfaceMetadata.optional(),
});

export type EServiceTemplateVersionRef = z.infer<
  typeof EServiceTemplateVersionRef
>;

export const archivingScope = {
  eservice: "EService",
  descriptor: "Descriptor",
} as const;
export const ArchivingScope = z.enum([
  Object.values(archivingScope)[0],
  ...Object.values(archivingScope).slice(1),
]);
export type ArchivingScope = z.infer<typeof ArchivingScope>;

export const ArchivingSchedule = z.object({
  archivableOn: z.coerce.date(),
  startedAt: z.coerce.date(),
  scope: ArchivingScope,
});

export type ArchivingSchedule = z.infer<typeof ArchivingSchedule>;
export const AsyncExchangeProperties = z.object({
  responseTime: z.number().int(),
  resourceAvailableTime: z.number().int(),
  confirmation: z.boolean(),
  bulk: z.boolean(),
  maxResultSet: z.number().int(),
});
export type AsyncExchangeProperties = z.infer<typeof AsyncExchangeProperties>;

export const Descriptor = z.object({
  id: DescriptorId,
  version: z.string(),
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  state: DescriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: AgreementApprovalPolicy.optional(),
  createdAt: z.coerce.date(),
  serverUrls: z.array(z.string()),
  publishedAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  attributes: EServiceAttributes,
  rejectionReasons: z.array(DescriptorRejectionReason).optional(),
  templateVersionRef: EServiceTemplateVersionRef.optional(),
  archivingSchedule: ArchivingSchedule.optional(),
  asyncExchangeCallbackInterface: Document.optional(),
  asyncExchangeProperties: AsyncExchangeProperties.optional(),
});
export type Descriptor = z.infer<typeof Descriptor>;

export const eserviceMode = {
  receive: "Receive",
  deliver: "Deliver",
} as const;
export const EServiceMode = z.enum([
  Object.values(eserviceMode)[0],
  ...Object.values(eserviceMode).slice(1),
]);
export type EServiceMode = z.infer<typeof EServiceMode>;

export const EService = z.object({
  id: EServiceId,
  producerId: TenantId,
  name: z.string(),
  description: z.string(),
  technology: Technology,
  attributes: EServiceAttributes.optional(),
  descriptors: z.array(Descriptor),
  createdAt: z.coerce.date(),
  riskAnalysis: z.array(RiskAnalysis),
  mode: EServiceMode,
  isSignalHubEnabled: z.boolean().optional(),
  isConsumerDelegable: z.boolean().optional(),
  isClientAccessDelegable: z.boolean().optional(),
  templateId: EServiceTemplateId.optional(),
  personalData: z.boolean().optional(),
  instanceLabel: z.string().optional(),
  archivingReason: z.string().optional(),
  asyncExchange: z.boolean().optional(),
});

export type EService = z.infer<typeof EService>;
