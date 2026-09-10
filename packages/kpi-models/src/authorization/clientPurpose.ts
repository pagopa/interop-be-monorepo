import { createSelectSchema } from "drizzle-zod";
import { clientPurposeInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientPurposeSchema = createSelectSchema(
  clientPurposeInReadmodelClient
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ClientPurposeSchema = z.infer<typeof ClientPurposeSchema>;
