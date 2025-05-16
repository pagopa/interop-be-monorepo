import { PurposeSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const PurposeSchema = z.object({
  id: z.string().uuid(),
  metadata_version: z.number().int(),
  eservice_id: z.string().uuid(),
  consumer_id: z.string().uuid(),
  delegation_id: z.string().uuid().nullable(),
  suspended_by_consumer: z.boolean().nullable(),
  suspended_by_producer: z.boolean().nullable(),
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  is_free_of_charge: z.boolean(),
  free_of_charge_reason: z.string().nullable(),
  deleted: z.boolean().default(false).optional(),
});
export type PurposeSchema = z.infer<typeof PurposeSchema>;

export const PurposeDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false).optional(),
});

export type PurposeDeletingSchema = z.infer<typeof PurposeDeletingSchema>;

export type PurposeMapping = {
  [K in keyof PurposeSchema]: (record: PurposeSQL) => PurposeSchema[K];
};
