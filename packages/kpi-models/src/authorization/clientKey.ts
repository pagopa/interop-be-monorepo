import { createSelectSchema } from "drizzle-zod";
import { clientKeyInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientKeySchema = createSelectSchema(
  clientKeyInReadmodelClient
).extend({
  deleted: z.boolean().default(false).optional(),
  deleted_at: z.string().optional(),
});
export type ClientKeySchema = z.infer<typeof ClientKeySchema>;
