import { EServiceDescriptorSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceDescriptorSchema = z.object({
  id: z.string(),
  eservice_id: z.string(),
  metadata_version: z.number(),
  version: z.number(),
  description: z.string().nullable(),
  created_at: z.string(),
  state: z.string(),
  audience: z.string(),
  voucher_lifespan: z.number(),
  daily_calls_per_consumer: z.number(),
  daily_calls_total: z.number(),
  server_urls: z.string(),
  agreement_approval_policy: z.string().nullable(),
  published_at: z.string().nullable(),
  suspended_at: z.string().nullable(),
  deprecated_at: z.string().nullable(),
  archived_at: z.string().nullable(),
});
export type EserviceDescriptorSchema = z.infer<typeof EserviceDescriptorSchema>;

export type EserviceDescriptorMapping = {
  [K in keyof EserviceDescriptorSchema]: (
    record: EServiceDescriptorSQL
  ) => EserviceDescriptorSchema[K];
};

export const EserviceDescriptorDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});
export type EserviceDescriptorDeletingSchema = z.infer<
  typeof EserviceDescriptorDeletingSchema
>;
