import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eserviceInReadmodelCatalog } from "pagopa-interop-readmodel-models";

export const EserviceSchema = createSelectSchema(
  eserviceInReadmodelCatalog
).extend({
  deleted: z.boolean().default(false).optional(),
});
export type EserviceSchema = z.infer<typeof EserviceSchema>;
