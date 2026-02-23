import { createSelectSchema } from "drizzle-zod";
import { clientUserInReadmodelClient } from "pagopa-interop-readmodel-models";
import { z } from "zod";

export const ClientUserSchema = createSelectSchema(
  clientUserInReadmodelClient
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ClientUserSchema = z.infer<typeof ClientUserSchema>;
