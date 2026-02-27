import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { clientInReadmodelClient } from "pagopa-interop-readmodel-models";

export const ClientSchema = createSelectSchema(clientInReadmodelClient).extend({
  deleted: z.boolean().default(false).optional(),
});
export type ClientSchema = z.infer<typeof ClientSchema>;
