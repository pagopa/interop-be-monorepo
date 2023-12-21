import z from "zod";

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

export const agreementAttributeType = {
  CERTIFIED: "Certified",
  VERIFIED: "Verified",
  DECLARED: "Declared",
} as const;

export const AgreementAttributeType = z.enum([
  Object.values(agreementAttributeType)[0],
  ...Object.values(agreementAttributeType).slice(1),
]);

export type AgreementAttributeType = z.infer<typeof AgreementAttributeType>;

const AgreementAttribute = z.object({ id: z.string().uuid() });
export type AgreementAttribute = z.infer<typeof AgreementAttribute>;

export const CertifiedAgreementAttribute = z.object({
  type: z.literal(agreementAttributeType.CERTIFIED),
  id: z.string().uuid(),
});
export type CertifiedAgreementAttribute = z.infer<
  typeof CertifiedAgreementAttribute
>;
export const DeclaredAgreementAttribute = z.object({
  type: z.literal(agreementAttributeType.DECLARED),
  id: z.string().uuid(),
});
export type DeclaredAgreementAttribute = z.infer<
  typeof DeclaredAgreementAttribute
>;

export const VerifiedAgreementAttribute = z.object({
  type: z.literal(agreementAttributeType.VERIFIED),
  id: z.string().uuid(),
});
export type VerifiedAgreementAttribute = z.infer<
  typeof VerifiedAgreementAttribute
>;

export const AgreementDocument = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.date(),
});
export type AgreementDocument = z.infer<typeof AgreementDocument>;

export const AgreementStamp = z.object({
  who: z.string().uuid(),
  when: z.date(),
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

export const Agreement = z.object({
  id: z.string().uuid(),
  eserviceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  producerId: z.string().uuid(),
  consumerId: z.string().uuid(),
  state: AgreementState,
  verifiedAttributes: z.array(AgreementAttribute),
  certifiedAttributes: z.array(AgreementAttribute),
  declaredAttributes: z.array(AgreementAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  consumerDocuments: z.array(AgreementDocument),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  consumerNotes: z.string().optional(),
  contract: AgreementDocument.optional(),
  stamps: AgreementStamps,
  rejectionReason: z.string().optional(),
  suspendedAt: z.date().optional(),
});
export type Agreement = z.infer<typeof Agreement>;

export const UpdateAgreementSeed = z.object({
  state: AgreementState,
  certifiedAttributes: z.array(CertifiedAgreementAttribute),
  declaredAttributes: z.array(DeclaredAgreementAttribute),
  verifiedAttributes: z.array(VerifiedAgreementAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  stamps: AgreementStamps,
  consumerNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
  suspendedAt: z.date().optional(),
});
export type UpdateAgreementSeed = z.infer<typeof UpdateAgreementSeed>;

export const PDFPayload = z.object({
  today: z.date(),
  agreementId: z.string().uuid(),
  eService: z.string(),
  producerName: z.string(),
  producerOrigin: z.string(),
  producerIPACode: z.string(),
  consumerName: z.string(),
  consumerOrigin: z.string(),
  consumerIPACode: z.string(),
  certified: z.array(
    z.tuple([AgreementAttribute, CertifiedAgreementAttribute])
  ),
  declared: z.array(z.tuple([AgreementAttribute, DeclaredAgreementAttribute])),
  verified: z.array(z.tuple([AgreementAttribute, VerifiedAgreementAttribute])),
  submitter: z.string(),
  submissionTimestamp: z.date(),
  activator: z.string(),
  activationTimestamp: z.date(),
});

export type PDFPayload = z.infer<typeof PDFPayload>;

export const AgreementInvolvedAttributes = z.object({
  certified: z.array(
    z.tuple([AgreementAttribute, CertifiedAgreementAttribute])
  ),
  declared: z.array(z.tuple([AgreementAttribute, DeclaredAgreementAttribute])),
  verified: z.array(z.tuple([AgreementAttribute, VerifiedAgreementAttribute])),
});

export type AgreementInvolvedAttributes = z.infer<
  typeof AgreementInvolvedAttributes
>;
