// eservice.ts
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const EserviceSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  name: z.string(),
  created_at: z.string(),
  producer_id: z.string(),
  description: z.string(),
  technology: z.string(),
  mode: z.string(),
  is_signal_hub_enabled: z.boolean().nullable(),
  is_consumer_delegable: z.boolean().nullable(),
  is_client_access_delegable: z.boolean().nullable(),
  deleted: z.boolean().default(false).optional(),
});
export type EserviceSchema = z.infer<typeof EserviceSchema>;

export const EserviceDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false).optional(),
});
export type EserviceDeletingSchema = z.infer<typeof EserviceDeletingSchema>;

export type EserviceMapping = {
  [K in keyof EserviceSchema]: (record: EServiceSQL) => EserviceSchema[K];
};
