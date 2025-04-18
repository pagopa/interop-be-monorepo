import { z } from "zod";
import { AgreementSQL } from "pagopa-interop-readmodel-models";

export const agreementSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  eservice_id: z.string(),
  descriptor_id: z.string(),
  producer_id: z.string(),
  consumer_id: z.string(),
  state: z.string(),
  suspended_by_consumer: z.string().nullable(),
  suspended_by_producer: z.string().nullable(),
  suspended_by_platform: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  consumer_notes: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  suspended_at: z.string().nullable(),
  deleted: z.boolean().default(false).optional(),
});

export const agreementDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false).optional(),
});

type AgreementSchema = z.infer<typeof agreementSchema>;
export type AgreementMapping = {
  [K in keyof AgreementSchema]: (r: AgreementSQL) => AgreementSchema[K];
};
