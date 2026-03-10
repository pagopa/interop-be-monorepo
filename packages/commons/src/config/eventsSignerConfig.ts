import { z } from "zod";

export const EventsSignerConfig = z
  .object({
    SIGNATURE_REFERENCES_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    signatureReferencesTableName: c.SIGNATURE_REFERENCES_TABLE_NAME,
  }));

export type EventsSignerConfig = z.infer<typeof EventsSignerConfig>;
