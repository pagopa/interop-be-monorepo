// eservice.ts
import { EServiceSQL } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const eserviceSchema = z.object({
  id: z.string(),
  metadata_version: z.number(),
  name: z.string(),
  created_at: z.string(),
  producer_id: z.string(),
  description: z.string(),
  technology: z.string(),
  mode: z.string(),
  is_signal_hub_enabled: z.string().nullable(),
  is_consumer_delegable: z.string().nullable(),
  is_client_access_delegable: z.string().nullable(),
  deleted: z.boolean().default(false).optional(),
});

export const eserviceDeletingSchema = z.object({
  id: z.string(),
  deleted: z.boolean().default(false).optional(),
});

type EserviceSchema = z.infer<typeof eserviceSchema>;

export type EserviceMapping = {
  [K in keyof EserviceSchema]: (record: EServiceSQL) => EserviceSchema[K];
};
