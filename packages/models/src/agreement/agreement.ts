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

const AgreementAttribute = z.object({ id: z.string().uuid() });
export type AgreementAttribute = z.infer<typeof AgreementAttribute>;

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
