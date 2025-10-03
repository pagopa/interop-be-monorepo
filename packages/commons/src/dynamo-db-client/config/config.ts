import { z } from "zod";

export const DynamoDBClientConfig = z
  .object({
    SIGNATURE_REFERENCES_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    signatureReferencesTableName: c.SIGNATURE_REFERENCES_TABLE_NAME,
  }));

export type DynamoDBClientConfig = z.infer<typeof DynamoDBClientConfig>;
