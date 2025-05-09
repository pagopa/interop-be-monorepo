import { z } from "zod";
import { AgreementSQL } from "pagopa-interop-readmodel-models";

export const AgreementSchema = z.object({
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
export type AgreementSchema = z.infer<typeof AgreementSchema>;

export const AgreementDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false).optional(),
});

export type AgreementDeletingSchema = z.infer<typeof AgreementSchema>;

export type AgreementMapping = {
  [K in keyof AgreementSchema]: (r: AgreementSQL) => AgreementSchema[K];
};
